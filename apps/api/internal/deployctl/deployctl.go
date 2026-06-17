package deployctl

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/queue"
	"github.com/unbindapp/unbind-api/internal/integrations/github"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	variables_service "github.com/unbindapp/unbind-api/internal/services/variables"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

// Redis key for the queue
const BUILDER_QUEUE_KEY = "unbind:build:queue"
const DEPENDENT_SERVICES_QUEUE_KEY = "unbind:dependent-services:queue"

// The request to deploy a service, includes environment for builder image
type DeploymentJobRequest struct {
	// If job has already been created in pending
	ExistingJobID       *uuid.UUID              `json:"existing_job_id"`
	ServiceID           uuid.UUID               `json:"service_id"`
	Source              schema.DeploymentSource `json:"source"`
	CommitSHA           string                  `json:"commit_sha"`
	CommitMessage       string                  `json:"commit_message"`
	GitBranch           string                  `json:"git_branch"`
	Environment         map[string]string       `json:"environment"`
	Committer           *schema.GitCommitter    `json:"committer"`
	DependsOnServiceIDs []uuid.UUID             `json:"depends_on_service_ids,omitempty"`
	DisableBuildCache   bool                    `json:"disable_build_cache,omitempty"`
}

// Handles triggering builds for services
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i DeploymentControllerInterface -p deployctl -s DeploymentController -o deployctl_iface.go
type DeploymentController struct {
	cfg             *config.Config
	k8s             k8s.KubeClientInterface
	jobQueue        *queue.Queue[DeploymentJobRequest]
	dependentQueue  *queue.Queue[DeploymentJobRequest]
	ctx             context.Context
	cancelFunc      context.CancelFunc
	repo            repositories.RepositoriesInterface
	githubClient    github.GithubClientInterface
	webhookService  webhooks_service.WebhooksServiceInterface
	variableService variables_service.VariablesServiceInterface
}

func NewDeploymentController(
	ctx context.Context,
	cancel context.CancelFunc,
	cfg *config.Config,
	k8s k8s.KubeClientInterface,
	redisClient *redis.Client,
	repositories repositories.RepositoriesInterface,
	githubClient github.GithubClientInterface,
	webeehookService webhooks_service.WebhooksServiceInterface,
	variableService variables_service.VariablesServiceInterface) *DeploymentController {
	jobQueue := queue.NewQueue[DeploymentJobRequest](redisClient, BUILDER_QUEUE_KEY)
	dependentQueue := queue.NewQueue[DeploymentJobRequest](redisClient, DEPENDENT_SERVICES_QUEUE_KEY)

	return &DeploymentController{
		cfg:             cfg,
		k8s:             k8s,
		jobQueue:        jobQueue,
		dependentQueue:  dependentQueue,
		ctx:             ctx,
		cancelFunc:      cancel,
		repo:            repositories,
		githubClient:    githubClient,
		webhookService:  webeehookService,
		variableService: variableService,
	}
}

// Start queue processor
func (self *DeploymentController) StartAsync() {
	// Start the job processor
	self.jobQueue.StartProcessor(self.ctx, self.processJob, self.k8s.CountActiveDeploymentJobs)

	// Start the dependent services processor
	self.dependentQueue.StartProcessor(self.ctx, self.processDependentJob, self.k8s.CountActiveDeploymentJobs)

	// Start the job status synchronizer
	go self.startStatusSynchronizer()
}

// Stop stops the deployment manager
func (self *DeploymentController) Stop() {
	self.cancelFunc()
}

// startStatusSynchronizer periodically synchronizes job statuses with Kubernetes
func (self *DeploymentController) startStatusSynchronizer() {
	ticker := time.NewTicker(30 * time.Second) // Sync every 30 seconds
	defer ticker.Stop()

	for {
		select {
		case <-self.ctx.Done():
			return
		case <-ticker.C:
			if err := self.SyncJobStatuses(context.Background()); err != nil {
				log.Error("Failed to sync job statuses", "err", err)
			}
		}
	}
}

// Populate build environment, take tag separately so we can use it to build from tag
// If deployment is provided, use stored deployment values for build configuration instead of service config values
func (self *DeploymentController) PopulateBuildEnvironment(ctx context.Context, serviceID uuid.UUID, gitTag *string, deployment *ent.Deployment) (map[string]string, error) {
	// Get the service
	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil {
		return nil, err
	}

	// Get deployment namespace
	namespace, err := self.repo.Service().GetDeploymentNamespace(ctx, service.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment namespace: %w", err)
	}

	// Get build secrets
	buildSecrets, err := self.k8s.GetSecretMap(ctx, service.KubernetesSecret, namespace, self.k8s.GetInternalClient())
	if err != nil {
		log.Error("Error getting secrets", "err", err)
		return nil, err
	}

	// Convert the byte arrays to base64 strings first
	serializableSecrets := make(map[string]string)
	for k, v := range buildSecrets {
		serializableSecrets[k] = base64.StdEncoding.EncodeToString(v)
	}

	// Serialize the map to JSON
	secretsJSON, err := json.Marshal(serializableSecrets)
	if err != nil {
		log.Error("Error marshalling secrets", "err", err)
		return nil, err
	}

	// Populate environment
	env := map[string]string{
		"EXTERNAL_UI_URL":       self.cfg.ExternalUIUrl,
		"DEPLOYMENT_NAMESPACE":  namespace,
		"SERVICE_REF":           service.ID.String(),
		"SERVICE_NAME":          service.KubernetesName,
		"SERVICE_TYPE":          string(service.Type),
		"SERVICE_PUBLIC":        strconv.FormatBool(service.Edges.ServiceConfig.IsPublic),
		"SERVICE_REPLICAS":      strconv.Itoa(int(service.Edges.ServiceConfig.Replicas)),
		"SERVICE_SECRET_NAME":   service.KubernetesSecret,
		"SERVICE_BUILD_SECRETS": string(secretsJSON),
	}

	if service.Edges.Environment != nil {
		env["SERVICE_ENVIRONMENT_REF"] = service.Edges.Environment.ID.String()
		if service.Edges.Environment.Edges.Project != nil {
			env["SERVICE_PROJECT_REF"] = service.Edges.Environment.Edges.Project.ID.String()
			if service.Edges.Environment.Edges.Project.Edges.Team != nil {
				env["SERVICE_TEAM_REF"] = service.Edges.Environment.Edges.Project.Edges.Team.ID.String()
			}
		}
	}

	// Volumes
	if len(service.Edges.ServiceConfig.Volumes) > 0 {
		// Serialize and b64 encode
		marshalled, err := json.Marshal(schema.AsV1Volumes(service.Edges.ServiceConfig.Volumes))
		if err != nil {
			return nil, err
		}
		env["SERVICE_VOLUMES"] = base64.StdEncoding.EncodeToString(marshalled)
	}

	// Init containers
	if len(service.Edges.ServiceConfig.InitContainers) > 0 {
		// Serialize and b64 encode
		marshalled, err := json.Marshal(schema.AsV1InitContainers(service.Edges.ServiceConfig.InitContainers))
		if err != nil {
			return nil, err
		}
		env["SERVICE_INIT_CONTAINERS"] = base64.StdEncoding.EncodeToString(marshalled)
	}

	// Resources
	if service.Edges.ServiceConfig.Resources != nil {
		// Marshal as string
		marshalled, err := json.Marshal(service.Edges.ServiceConfig.Resources.AsV1ResourceSpec())
		if err != nil {
			return nil, err
		}
		env["SERVICE_RESOURCES"] = base64.StdEncoding.EncodeToString(marshalled)
	}

	if service.Type == schema.ServiceTypeDatabase {
		if service.Database == nil ||
			service.Edges.ServiceConfig.DefinitionVersion == nil {
			return nil, fmt.Errorf("service database name or definition is nil")
		}

		var config *v1.DatabaseConfigSpec
		if service.Edges.ServiceConfig.DatabaseConfig != nil {
			config = service.Edges.ServiceConfig.DatabaseConfig.AsV1DatabaseConfig()
		}

		// Marshal as string
		marshalledConfig, err := json.Marshal(config)
		if err != nil {
			return nil, err
		}

		env["SERVICE_DATABASE_TYPE"] = *service.Database
		env["SERVICE_DATABASE_USD_VERSION"] = *service.Edges.ServiceConfig.DefinitionVersion
		env["SERVICE_DATABASE_CONFIG"] = base64.StdEncoding.EncodeToString(marshalledConfig)

		// Pass S3 backup stuff
		if service.Edges.ServiceConfig.S3BackupBucket != nil && service.Edges.ServiceConfig.S3BackupSourceID != nil {
			// Get S3 source
			s3Source, err := self.repo.S3().GetByID(ctx, *service.Edges.ServiceConfig.S3BackupSourceID)
			if err != nil {
				return nil, err
			}

			env["SERVICE_DATABASE_BACKUP_BUCKET"] = *service.Edges.ServiceConfig.S3BackupBucket
			env["SERVICE_DATABASE_BACKUP_REGION"] = s3Source.Region
			env["SERVICE_DATABASE_BACKUP_ENDPOINT"] = s3Source.Endpoint
			env["SERVICE_DATABASE_BACKUP_SECRET_NAME"] = s3Source.KubernetesSecret
			env["SERVICE_DATABASE_BACKUP_SCHEDULE"] = service.Edges.ServiceConfig.BackupSchedule
			env["SERVICE_DATABASE_BACKUP_RETENTION"] = strconv.Itoa(service.Edges.ServiceConfig.BackupRetentionCount)
		}
	}

	// Use deployment values for build configuration if available (for redeployments)
	// Otherwise fall back to service config values (for new deployments)
	var builder schema.ServiceBuilder
	var dockerfilePath *string
	var buildContext *string
	var railpackInstallCommand *string
	var railpackBuildCommand *string
	var runCommand *string

	if deployment != nil {
		// Use stored deployment build configuration
		builder = deployment.Builder
		dockerfilePath = deployment.DockerBuilderDockerfilePath
		buildContext = deployment.DockerBuilderBuildContext
		railpackInstallCommand = deployment.RailpackBuilderInstallCommand
		railpackBuildCommand = deployment.RailpackBuilderBuildCommand
		runCommand = deployment.RunCommand
	} else {
		// Use current service configuration
		builder = service.Edges.ServiceConfig.Builder
		dockerfilePath = service.Edges.ServiceConfig.DockerBuilderDockerfilePath
		buildContext = service.Edges.ServiceConfig.DockerBuilderBuildContext
		railpackInstallCommand = service.Edges.ServiceConfig.RailpackBuilderInstallCommand
		railpackBuildCommand = service.Edges.ServiceConfig.RailpackBuilderBuildCommand
		runCommand = service.Edges.ServiceConfig.RunCommand
	}

	// Add docker image override
	if service.Edges.ServiceConfig.Image != "" {
		env["SERVICE_IMAGE"] = service.Edges.ServiceConfig.Image
	}

	// Add dockerfile override
	if dockerfilePath != nil {
		env["SERVICE_DOCKER_BUILDER_DOCKERFILE_PATH"] = *dockerfilePath
	}

	// Also don't set context if it's the default
	if buildContext != nil && *buildContext != "." {
		env["SERVICE_DOCKER_BUILDER_BUILD_CONTEXT"] = *buildContext
	}

	// Add Github fields
	if service.GithubInstallationID != nil {
		if service.GitRepository == nil || (service.Edges.ServiceConfig.GitBranch == nil && service.Edges.ServiceConfig.GitTag == nil) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Missing required fields for Github service - doesn't have repository or git branch/tag")
		}
		// Get private key for the service's github app.
		// ! TODO - we can probably reduce these queries
		privKey, err := self.repo.Service().GetGithubPrivateKey(ctx, service.ID)
		if err != nil {
			log.Error("Error getting github private key", "err", err)
			return nil, err
		}

		env["GITHUB_APP_PRIVATE_KEY"] = privKey
		env["GITHUB_INSTALLATION_ID"] = strconv.Itoa(int(*service.GithubInstallationID))
		// Get GitHub installation
		installation, err := self.repo.Github().GetInstallationByID(ctx, *service.GithubInstallationID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "GitHub installation not found")
			}
			return nil, err
		}
		env["GITHUB_APP_ID"] = strconv.Itoa(int(installation.GithubAppID))

		// Verify repository access
		canAccess, cloneUrl, _, err := self.githubClient.VerifyRepositoryAccess(ctx, installation, installation.AccountLogin, *service.GitRepository)
		if err != nil {
			log.Error("Error verifying repository access", "err", err)
			return nil, err
		}

		if !canAccess {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Repository not accessible with the specified GitHub installation")
		}

		env["GITHUB_REPO_URL"] = cloneUrl

		if gitTag != nil {
			if !strings.HasPrefix(*gitTag, "refs/tags/") {
				*gitTag = "refs/tags/" + *gitTag
			}
			env["GIT_REF"] = *gitTag
		} else {
			ref := *service.Edges.ServiceConfig.GitBranch
			if !strings.HasPrefix(ref, "refs/head") {
				ref = "refs/heads/" + ref
			}
			env["GIT_REF"] = ref
		}
	}

	if service.Edges.ServiceConfig.RailpackProvider != nil {
		env["SERVICE_PROVIDER"] = string(*service.Edges.ServiceConfig.RailpackProvider)
	}

	if service.Edges.ServiceConfig.RailpackFramework != nil {
		env["SERVICE_FRAMEWORK"] = string(*service.Edges.ServiceConfig.RailpackFramework)
	}

	if builder != schema.ServiceBuilder("") {
		env["SERVICE_BUILDER"] = string(builder)
	}

	if len(service.Edges.ServiceConfig.Ports) > 0 {
		asV1Ports := make([]v1.PortSpec, len(service.Edges.ServiceConfig.Ports))
		for i, port := range service.Edges.ServiceConfig.Ports {
			asV1Ports[i] = port.AsV1PortSpec()
		}
		// Serialize
		marshalled, err := json.Marshal(asV1Ports)
		if err != nil {
			return nil, err
		}
		env["SERVICE_PORTS"] = string(marshalled)
	}

	if len(service.Edges.ServiceConfig.Hosts) > 0 {
		// ! Prune all hosts that don't have a target
		prunedHosts := []schema.HostSpec{}
		for _, host := range service.Edges.ServiceConfig.Hosts {
			if host.TargetPort != nil {
				prunedHosts = append(prunedHosts, host)
			}
		}
		// Serialize
		marshalled, err := json.Marshal(schema.AsV1HostSpecs(prunedHosts))
		if err != nil {
			return nil, err
		}
		env["SERVICE_HOSTS"] = string(marshalled)
	}

	if railpackInstallCommand != nil {
		env["RAILPACK_INSTALL_CMD"] = *railpackInstallCommand
	}

	if railpackBuildCommand != nil {
		env["RAILPACK_BUILD_CMD"] = *railpackBuildCommand
	}

	if runCommand != nil {
		env["SERVICE_RUN_COMMAND"] = *runCommand
	}

	if service.Edges.ServiceConfig.SecurityContext != nil {
		// Marshal as string
		marshalled, err := json.Marshal(service.Edges.ServiceConfig.SecurityContext.AsV1SecurityContext())
		if err != nil {
			return nil, err
		}
		env["SECURITY_CONTEXT"] = string(marshalled)
	}

	if service.Edges.ServiceConfig.HealthCheck != nil &&
		service.Edges.ServiceConfig.HealthCheck.Type != nil &&
		*service.Edges.ServiceConfig.HealthCheck.Type != schema.HealthCheckTypeNone {
		// Marshal as string
		marshalled, err := json.Marshal(service.Edges.ServiceConfig.HealthCheck.AsV1HealthCheck())
		if err != nil {
			return nil, err
		}
		env["SERVICE_HEALTH_CHECK"] = string(marshalled)
	}

	if len(service.Edges.ServiceConfig.VariableMounts) > 0 {
		// Marshal as string
		asV1Mounts := schema.AsV1VariableMounts(service.Edges.ServiceConfig.VariableMounts)
		marshalled, err := json.Marshal(asV1Mounts)
		if err != nil {
			return nil, err
		}
		env["SERVICE_VARIABLE_MOUNTS"] = string(marshalled)
	}

	return env, nil
}

// EnqueueDeploymentJob adds a deployment to the queue
func (self *DeploymentController) EnqueueDeploymentJob(ctx context.Context, req DeploymentJobRequest) (job *ent.Deployment, err error) {
	// Cancel any existing queued jobs
	if err := self.CancelExistingJobs(ctx, req.ServiceID); err != nil {
		return nil, fmt.Errorf("failed to cancel existing jobs: %w", err)
	}

	// Create a record in the database
	if req.ExistingJobID != nil {
		// Verify the deployment exists
		_, err := self.repo.Deployment().GetByID(ctx, *req.ExistingJobID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Deployment not found")
			}
			return nil, fmt.Errorf("failed to get existing job: %w", err)
		}

		// Update the job status as queued
		var markErr error
		job, markErr = self.repo.Deployment().MarkQueued(ctx, nil, *req.ExistingJobID, time.Now())
		if markErr != nil {
			return nil, fmt.Errorf("failed to mark job as queued: %w", markErr)
		}
	} else {
		job, err = self.repo.Deployment().Create(
			ctx,
			nil,
			req.ServiceID,
			req.CommitSHA,
			req.CommitMessage,
			req.GitBranch,
			req.Committer,
			req.Source,
			schema.DeploymentStatusBuildQueued,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to create deployment record: %w", err)
		}
	}

	if req.DisableBuildCache {
		req.Environment["DISABLE_BUILD_CACHE"] = "true"
	}

	req.Environment["SERVICE_DEPLOYMENT_ID"] = job.ID.String()

	// Resolve referenced environment
	referencedEnv, err := self.variableService.ResolveAllReferences(ctx, req.ServiceID)
	if err != nil {
		return nil, self.failWithErr(ctx, "Error resolving environment variables", job.ID, err)
	}

	// Convert the byte arrays to base64 strings first
	serializedReferences := make(map[string]string)
	for k, v := range referencedEnv {
		serializedReferences[k] = base64.StdEncoding.EncodeToString([]byte(v))
	}

	// Serialize the map to JSON
	referencedEnvJSON, err := json.Marshal(serializedReferences)
	if err != nil {
		return nil, self.failWithErr(ctx, "Error marshalling referenced secrets", job.ID, err)
	}
	// Add the referenced environment to the environment
	req.Environment["ADDITIONAL_ENV"] = string(referencedEnvJSON)

	// Get registry to use
	registry, err := self.repo.System().GetDefaultRegistry(ctx)
	if err != nil {
		return nil, self.failWithErr(ctx, "Error getting default registry", job.ID, err)
	}
	req.Environment["CONTAINER_REGISTRY_HOST"] = registry.Host

	// Get credentials if applicable
	var username, password string
	credentials, err := self.k8s.GetSecret(ctx, registry.KubernetesSecret, self.cfg.SystemNamespace, self.k8s.GetInternalClient())
	if err != nil {
		return nil, self.failWithErr(ctx, "Error getting registry credentials", job.ID, err)
	}
	username, password, err = self.k8s.ParseRegistryCredentials(credentials)
	if err != nil {
		return nil, self.failWithErr(ctx, "Error parsing registry credentials", job.ID, err)
	}
	req.Environment["CONTAINER_REGISTRY_USER"] = username
	req.Environment["CONTAINER_REGISTRY_PASSWORD"] = password

	// Add image pull secrets
	pullSecrets, err := self.repo.System().GetImagePullSecrets(ctx)
	if err != nil {
		return nil, self.failWithErr(ctx, "Error getting image pull secrets", job.ID, err)
	}
	if len(pullSecrets) > 0 {
		// Add to the environment, comma separated
		req.Environment["IMAGE_PULL_SECRETS"] = strings.Join(pullSecrets, ",")
	}

	// Add to the queue
	err = self.jobQueue.Enqueue(ctx, job.ID.String(), req)
	if err != nil {
		return nil, fmt.Errorf("failed to enqueue job: %w", err)
	}

	// Trigger webhook
	go func() {
		event := schema.WebhookEventDeploymentQueued
		level := webhooks_service.WebhookLevelDeploymentQueued

		// Get service with edges
		service, err := self.repo.Service().GetByID(context.Background(), req.ServiceID)
		if err != nil {
			log.Errorf("Failed to get service %s: %v", req.ServiceID.String(), err)
			return
		}

		// Construct URL
		basePath, _ := utils.JoinURLPaths(
			self.cfg.ExternalUIUrl,
			service.Edges.Environment.Edges.Project.Edges.Team.ID.String(),
			"project",
			service.Edges.Environment.Edges.Project.ID.String(),
		)
		url := basePath + "?environment=" + service.EnvironmentID.String() +
			"&service=" + service.ID.String() +
			"&deployment=" + job.ID.String()
		data := webhooks_service.WebhookData{
			Title: "Deployment Queued",
			Url:   url,
			Fields: []webhooks_service.WebhookDataField{
				{
					Name:  "Service",
					Value: service.Name,
				},
				{
					Name:  "Project & Environment",
					Value: fmt.Sprintf("%s > %s", service.Edges.Environment.Edges.Project.Name, service.Edges.Environment.Name),
				},
			},
		}

		if err := self.webhookService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
			log.Errorf("Failed to trigger webhook %s: %v", event, err)
		}
	}()

	return job, nil
}

func (self *DeploymentController) failWithErr(ctx context.Context, msg string, deploymentID uuid.UUID, err error) error {
	log.Error(msg, "err", err)
	if _, failErr := self.repo.Deployment().MarkFailed(ctx, nil, deploymentID, err.Error(), time.Now()); failErr != nil {
		log.Error("Error marking job as failed", "err", failErr)
	}
	return err
}

// cancelExistingJobs marks all pending jobs for a service as cancelled in the DB
// and removes them from the queue
func (self *DeploymentController) CancelExistingJobs(ctx context.Context, serviceID uuid.UUID) error {
	// 1. Get all queued jobs for this service from the queue
	queuedJobs, err := self.jobQueue.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("failed to get jobs from queue: %w", err)
	}
	queuedDependentJobs, err := self.dependentQueue.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("failed to get dependent jobs from queue: %w", err)
	}

	// Keep track of job IDs to mark as cancelled
	var jobIDsToCancel []uuid.UUID

	// 2. Remove matching jobs from the queue
	for _, item := range queuedJobs {
		if item.Data.ServiceID == serviceID {
			// Remove from queue
			if err := self.jobQueue.Remove(ctx, item.ID); err != nil {
				log.Errorf("Failed to remove job %s from queue: %v", item.ID, err)
			}
			idParsed, _ := uuid.Parse(item.ID)
			jobIDsToCancel = append(jobIDsToCancel, idParsed)
		}
	}
	for _, item := range queuedDependentJobs {
		if item.Data.ServiceID == serviceID {
			// Remove from queue
			if err := self.dependentQueue.Remove(ctx, item.ID); err != nil {
				log.Errorf("Failed to remove job %s from queue: %v", item.ID, err)
			}
			idParsed, _ := uuid.Parse(item.ID)
			jobIDsToCancel = append(jobIDsToCancel, idParsed)
		}
	}

	// 3. Mark the jobs as cancelled in the database
	if len(jobIDsToCancel) > 0 {
		if err := self.repo.Deployment().MarkAsCancelled(ctx, jobIDsToCancel); err != nil {
			return fmt.Errorf("failed to mark jobs as cancelled: %w", err)
		}
	}

	// Trigger webhooks
	for _, jobID := range jobIDsToCancel {
		// Trigger webhook
		go func() {
			event := schema.WebhookEventDeploymentCancelled
			level := webhooks_service.WebhookLevelWarning

			// Get service with edges
			service, err := self.repo.Service().GetByID(context.Background(), serviceID)
			if err != nil {
				log.Errorf("Failed to get service %s: %v", serviceID.String(), err)
				return
			}

			// Construct URL
			url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, service.Edges.Environment.Edges.Project.Edges.Team.ID.String(), "project", service.Edges.Environment.Edges.Project.ID.String(), "?environment="+service.EnvironmentID.String(), "&service="+service.ID.String(), "&deployment="+jobID.String())
			data := webhooks_service.WebhookData{
				Title: "Deployment Cancelled",
				Url:   url,
				Fields: []webhooks_service.WebhookDataField{
					{
						Name:  "Service",
						Value: service.Name,
					},
					{
						Name:  "Project & Environment",
						Value: fmt.Sprintf("%s > %s", service.Edges.Environment.Edges.Project.Name, service.Edges.Environment.Name),
					},
				},
			}

			if err := self.webhookService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
				log.Errorf("Failed to trigger webhook %s: %v", event, err)
			}
		}()
	}

	return nil
}

// processJob processes a job from the queue
func (self *DeploymentController) processJob(ctx context.Context, item *queue.QueueItem[DeploymentJobRequest]) error {
	jobID, _ := uuid.Parse(item.ID)
	req := item.Data

	// Update the job status in the database
	err := self.repo.Deployment().MarkCancelledExcept(ctx, req.ServiceID, jobID)
	if err != nil {
		log.Warnf("Failed to mark job as cancelled: %v service: %s", err, req.ServiceID)
	}
	// ! TODO - webhook for cancel
	// Cancel jobs in Kubernetes
	if err := self.k8s.CancelJobsByServiceID(ctx, req.ServiceID.String()); err != nil {
		log.Warnf("Failed to cancel existing jobs: %v service: %s", err, req.ServiceID)
	}

	// ! This is our time starting the job, not the actual time kubernetes started running it - maybe we should do soemthing different
	_, err = self.repo.Deployment().MarkStarted(ctx, nil, jobID, time.Now())

	if err != nil {
		return fmt.Errorf("failed to mark job started: %w", err)
	}

	// Start the actual Kubernetes job
	k8sJobName, err := self.k8s.CreateDeployment(ctx, jobID.String(), req.Environment)
	if err != nil {
		log.Error("Failed to create Kubernetes job", "err", err)

		// Update status to failed
		_, dbErr := self.repo.Deployment().MarkFailed(ctx, nil, jobID, err.Error(), time.Now())

		if dbErr != nil {
			log.Error("Failed to update job failure status", "err", dbErr)
		}
		return err
	}

	// Update the Kubernetes job name in the database
	_, err = self.repo.Deployment().AssignKubernetesJobName(ctx, jobID, k8sJobName)

	if err != nil {
		log.Error("Failed to update Kubernetes job name in database", "err", err, "jobID", jobID, "k8sJobName", k8sJobName)
	}

	return nil
}

// SyncJobStatuses synchronizes the status of all processing jobs with Kubernetes
func (self *DeploymentController) SyncJobStatuses(ctx context.Context) error {
	// Get all job marked running status
	jobs, err := self.repo.Deployment().GetJobsByStatus(ctx, schema.DeploymentStatusBuildRunning)
	if err != nil {
		return fmt.Errorf("failed to query processing jobs: %w", err)
	}

	for _, job := range jobs {
		if job.KubernetesJobName == "" {
			continue
		}

		k8sStatus, err := self.k8s.GetJobStatus(ctx, job.KubernetesJobName)
		if err != nil {
			log.Error("Failed to get Kubernetes job status", "err", err, "jobID", job.ID)
			continue
		}

		// Update based on Kubernetes status
		switch k8sStatus.ConditionType {
		case k8s.JobSucceeded:
			_, err = self.repo.Deployment().MarkSucceeded(ctx, nil, job.ID, k8sStatus.CompletedTime)
		case k8s.JobFailed:
			_, err = self.repo.Deployment().MarkFailed(ctx, nil, job.ID, k8sStatus.FailureReason, k8sStatus.FailedTime)
		default:
			_, err = self.repo.Deployment().SetKubernetesJobStatus(ctx, job.ID, k8sStatus.ConditionType.String())
		}

		if err != nil {
			log.Error("Failed to update job status", "err", err, "jobID", job.ID)
		}
	}

	return nil
}

// processDependentJob processes a job from the dependent services queue
func (self *DeploymentController) processDependentJob(ctx context.Context, item *queue.QueueItem[DeploymentJobRequest]) error {
	// Check if dependencies are ready
	if !self.AreDependenciesReady(ctx, item.Data) {
		// If dependencies aren't ready, put the job back in the queue
		return self.dependentQueue.Enqueue(ctx, item.ID, item.Data)
	}

	// If dependencies are ready, enqueue to the real deployment queue
	_, err := self.EnqueueDeploymentJob(ctx, item.Data)
	return err
}

// AreDependenciesReady checks if all dependencies for a service are ready
func (self *DeploymentController) AreDependenciesReady(ctx context.Context, req DeploymentJobRequest) bool {
	// Try to resolve all references
	_, err := self.variableService.ResolveAllReferences(ctx, req.ServiceID)
	if err != nil {
		// If we can't resolve references, dependencies aren't ready
		return false
	}

	// Check depends on map
	if len(req.DependsOnServiceIDs) == 0 {
		return true
	}

	// Get namespace
	namespace, err := self.repo.Service().GetDeploymentNamespace(ctx, req.ServiceID)
	if err != nil {
		log.Error("Failed to get deployment namespace - dependency ready check", "err", err, "serviceID", req.ServiceID)
		return false
	}
	for _, depServiceID := range req.DependsOnServiceIDs {
		status, err := self.k8s.GetSimpleHealthStatus(
			ctx,
			namespace,
			map[string]string{
				"unbind-service": depServiceID.String(),
			},
			nil,
			self.k8s.GetInternalClient(),
		)
		if err != nil {
			log.Error("Failed to get health status for dependent service", "err", err, "serviceID", depServiceID)
			return false
		}

		if status.Health != k8s.InstanceHealthActive {
			return false
		}
	}

	// If we can resolve all references, dependencies are ready
	return true
}

// EnqueueDependentDeployment adds a deployment to the dependent services queue
func (self *DeploymentController) EnqueueDependentDeployment(ctx context.Context, req DeploymentJobRequest) (*ent.Deployment, error) {
	// Create as pending
	job, err := self.repo.Deployment().Create(
		ctx,
		nil,
		req.ServiceID,
		req.CommitSHA,
		req.CommitMessage,
		req.GitBranch,
		req.Committer,
		req.Source,
		schema.DeploymentStatusBuildPending)
	if err != nil {
		return nil, fmt.Errorf("failed to create dependent deployment record: %w", err)
	}
	req.ExistingJobID = utils.ToPtr(job.ID)
	// Add to the dependent queue
	return job, self.dependentQueue.Enqueue(ctx, uuid.New().String(), req)
}
