package service_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
	"github.com/unbindapp/unbind-api/internal/infrastructure/s3"
	"github.com/unbindapp/unbind-api/internal/integrations/github"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	deployments_service "github.com/unbindapp/unbind-api/internal/services/deployments"
	variables_service "github.com/unbindapp/unbind-api/internal/services/variables"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	"github.com/unbindapp/unbind-api/pkg/databases"
	"k8s.io/client-go/kubernetes"
)

// Integrate service management with internal permissions and kubernetes RBAC
type ServiceService struct {
	cfg                  *config.Config
	repo                 repositories.RepositoriesInterface
	githubClient         *github.GithubClient
	k8s                  k8s.KubeClientInterface
	deploymentController *deployctl.DeploymentController
	dbProvider           *databases.DatabaseProvider
	webhookService       *webhooks_service.WebhooksService
	variableService      *variables_service.VariablesService
	promClient           *prometheus.PrometheusClient
	deploymentService    *deployments_service.DeploymentService
}

func NewServiceService(cfg *config.Config,
	repo repositories.RepositoriesInterface,
	githubClient *github.GithubClient,
	k8s k8s.KubeClientInterface,
	deploymentController *deployctl.DeploymentController,
	dbProvider *databases.DatabaseProvider,
	webhookService *webhooks_service.WebhooksService,
	variableService *variables_service.VariablesService,
	promClient *prometheus.PrometheusClient,
	deploymentService *deployments_service.DeploymentService) *ServiceService {
	return &ServiceService{
		cfg:                  cfg,
		repo:                 repo,
		githubClient:         githubClient,
		k8s:                  k8s,
		deploymentController: deploymentController,
		dbProvider:           dbProvider,
		webhookService:       webhookService,
		variableService:      variableService,
		promClient:           promClient,
		deploymentService:    deploymentService,
	}
}

func (self *ServiceService) VerifyInputs(ctx context.Context, teamID, projectID, environmentID uuid.UUID) (*ent.Environment, *ent.Project, error) {
	// Verify that the environment exists
	environment, err := self.repo.Environment().GetByID(ctx, environmentID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
		}
		return nil, nil, err
	}

	if environment == nil {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
	}

	if environment.Edges.Project == nil {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment does not belong to a project")
	}

	if environment.Edges.Project.ID != projectID {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment does not belong to the specified project")
	}

	if environment.Edges.Project.Edges.Team == nil {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment does not belong to a team")
	}

	if environment.Edges.Project.Edges.Team.ID != teamID {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project does not belong to the specified team")
	}

	return environment, environment.Edges.Project, nil
}

func (self *ServiceService) generateWildcardHost(ctx context.Context, tx repository.TxInterface, kubernetesName string, ports []schema.PortSpec) (*schema.HostSpec, error) {
	settings, err := self.repo.System().GetSystemSettings(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("failed to get system settings: %w", err)
	}

	if settings.WildcardBaseURL == nil || *settings.WildcardBaseURL == "" {
		return nil, nil // No wildcard base URL configured
	}

	domain, err := utils.GenerateSubdomain(kubernetesName, *settings.WildcardBaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate subdomain: %w", err)
	}

	domainCount, err := self.repo.Service().CountDomainCollisons(ctx, tx, domain, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to count domain collisions: %w", err)
	}

	if domainCount > 0 {
		domain, err = utils.GenerateSubdomain(fmt.Sprintf("%s-%d", kubernetesName, domainCount), *settings.WildcardBaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to generate subdomain with suffix: %w", err)
		}
	}

	return &schema.HostSpec{
		Host:       domain,
		Path:       "/",
		TargetPort: utils.ToPtr(ports[0].Port),
	}, nil
}

func (self *ServiceService) verifyS3Access(ctx context.Context, s3Source *ent.S3, bucket string, namespace string, client kubernetes.Interface) error {
	// Retrieve secret from kubernetes
	secret, err := self.k8s.GetSecret(ctx, s3Source.KubernetesSecret, namespace, client)
	if err != nil {
		return err
	}
	accessKeyId := string(secret.Data["access_key_id"])
	secretKey := string(secret.Data["secret_key"])
	if accessKeyId == "" || secretKey == "" {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput,
			"S3 source secret is missing access key or secret key")
	}

	s3Client, err := s3.NewS3Client(
		ctx,
		s3Source.Endpoint,
		s3Source.Region,
		accessKeyId,
		secretKey,
	)
	if err != nil {
		return err
	}

	// Probe the bucket
	err = s3Client.ProbeBucketRW(ctx, bucket)
	if err != nil {
		// s3 client already transforms into API handler compatible errors
		return err
	}

	return nil
}

func (self *ServiceService) validatePVC(ctx context.Context, teamID, projectID, environmentID uuid.UUID, name, namespace string, client kubernetes.Interface) error {
	isInUse, err := self.repo.Service().IsVolumeInUse(ctx, name)
	if err != nil {
		return err
	}
	if isInUse {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "PVC is already in use by another service")
	}

	// Get the actual PVC from k8s
	pvc, err := self.k8s.GetPersistentVolumeClaim(ctx, namespace, name, client)
	if err != nil {
		return err
	}
	if !pvc.IsAvailable {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "PVC is not available")
	}

	// Verify scope
	if pvc.TeamID != teamID {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "PVC not found")
	}

	if pvc.ProjectID != nil && *pvc.ProjectID != projectID {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "PVC not found")
	}

	if pvc.EnvironmentID != nil && *pvc.EnvironmentID != environmentID {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "PVC not found")
	}

	return nil
}

// Add volumes to service config
func (self *ServiceService) getVolumesForServices(ctx context.Context, namespace string, teamID uuid.UUID, services []*ent.Service) (map[uuid.UUID][]*models.PVCInfo, error) {
	if len(services) == 0 {
		return nil, nil
	}

	// Create a map of service ID to service for easy access
	serviceMap := make(map[uuid.UUID]*ent.Service)
	for _, service := range services {
		serviceMap[service.ID] = service
	}

	// 1) List all PVCs in team
	allPVCs, err := self.k8s.ListPersistentVolumeClaims(ctx, namespace, map[string]string{
		"unbind-team": teamID.String(),
	}, self.k8s.GetInternalClient())
	if err != nil {
		return nil, fmt.Errorf("failed to list PVCs for team: %w", err)
	}

	// 2) Filter PVCs to ones mounted on the services we're interested in
	var relevantPVCs []*models.PVCInfo
	var pvcNames []string

	for _, pvc := range allPVCs {
		// Check if this PVC is mounted on one of our services
		if pvc.MountedOnServiceID != nil {
			_, exists := serviceMap[*pvc.MountedOnServiceID]
			if exists {
				relevantPVCs = append(relevantPVCs, pvc)
				pvcNames = append(pvcNames, pvc.ID)
			}
		}
	}

	if len(relevantPVCs) == 0 {
		// No PVCs mounted on these services
		result := make(map[uuid.UUID][]*models.PVCInfo)
		for _, service := range services {
			result[service.ID] = []*models.PVCInfo{}
		}
		return result, nil
	}

	// 3) Get usage stats from Prometheus for the relevant PVCs
	var usageStats map[string]*prometheus.PVCVolumeStats
	if len(pvcNames) > 0 {
		stats, err := self.promClient.GetPVCsVolumeStats(ctx, pvcNames, namespace, self.k8s.GetInternalClient())
		if err != nil {
			log.Errorf("Failed to get PVC stats from Prometheus: %v", err)
			usageStats = make(map[string]*prometheus.PVCVolumeStats)
		} else {
			usageStats = make(map[string]*prometheus.PVCVolumeStats)
			for _, stat := range stats {
				if stat != nil {
					usageStats[stat.PVCName] = stat
				}
			}
		}
	}

	// 4) Get PVC metadata for all volumes
	pvcMetadata, err := self.repo.System().GetPVCMetadata(ctx, nil, pvcNames)
	if err != nil {
		log.Errorf("Failed to get PVC metadata: %v", err)
		return nil, err
	}

	// 5) Build the result map and attach mount paths and usage stats
	result := make(map[uuid.UUID][]*models.PVCInfo)

	// Initialize empty slices for all services
	for _, service := range services {
		result[service.ID] = []*models.PVCInfo{}
	}

	// Process each relevant PVC
	for _, pvc := range relevantPVCs {
		serviceID := *pvc.MountedOnServiceID
		service := serviceMap[serviceID]

		// Attach usage stats if available
		if usageStats != nil {
			if stat, hasStats := usageStats[pvc.ID]; hasStats && stat.UsedGB != nil {
				pvc.UsedGB = stat.UsedGB
			}
		}

		// Attach mount path
		if service.Type == schema.ServiceTypeDatabase {
			// For database services, use /database as mount path (since we don't store it ourselves)
			// Guess based on db type though
			if service.Database != nil {
				pvc.MountPath = utils.InferOperatorPVCMountPath(*service.Database)
			}
			if pvc.MountPath == nil {
				pvc.MountPath = utils.ToPtr("/database")
			}
		} else {
			// For other services, use mount path from service config
			for _, volumeMount := range service.Edges.ServiceConfig.Volumes {
				if volumeMount.ID == pvc.ID {
					pvc.MountPath = utils.ToPtr(volumeMount.MountPath)
				}
			}
		}

		// Attach metadata
		if metadata, ok := pvcMetadata[pvc.ID]; ok {
			if metadata.Name != nil {
				pvc.Name = *metadata.Name
			} else {
				pvc.Name = pvc.ID
			}
			pvc.Description = metadata.Description
		} else {
			pvc.Name = pvc.ID
		}

		// Add to result
		result[serviceID] = append(result[serviceID], pvc)
	}

	return result, nil
}
