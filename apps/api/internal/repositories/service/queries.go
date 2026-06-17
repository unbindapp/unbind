package service_repo

import (
	"context"
	"fmt"
	"reflect"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/deployment"
	"github.com/unbindapp/unbind-api/ent/githubapp"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/serviceconfig"
	"github.com/unbindapp/unbind-api/ent/team"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

func (self *ServiceRepository) GetByID(ctx context.Context, serviceID uuid.UUID) (svc *ent.Service, err error) {
	svc, err = self.base.DB.Service.Query().
		Where(service.IDEQ(serviceID)).
		WithServiceGroup().
		WithEnvironment(func(eq *ent.EnvironmentQuery) {
			eq.WithProject(func(pq *ent.ProjectQuery) {
				pq.WithTeam()
			})
		}).
		WithServiceConfig().
		WithDeployments(func(dq *ent.DeploymentQuery) {
			dq.Order(ent.Desc(deployment.FieldCreatedAt))
			dq.Limit(1)
		}).
		WithCurrentDeployment().
		WithTemplate().
		Only(ctx)

	if err != nil {
		return nil, err
	}
	// Get the latest successful deployment for the service, if needed
	if len(svc.Edges.Deployments) == 0 || svc.Edges.Deployments[0].Status != schema.DeploymentStatusBuildSucceeded {
		lastSuccessfulDeployment, err := self.deploymentRepo.GetLastSuccessfulDeployment(ctx, svc.ID)
		if err != nil && !ent.IsNotFound(err) {
			return nil, err
		}
		if !ent.IsNotFound(err) {
			svc.Edges.Deployments = append(svc.Edges.Deployments, lastSuccessfulDeployment)
		}
	}
	return svc, nil
}

func (self *ServiceRepository) GetByIDsAndEnvironment(ctx context.Context, serviceIDs []uuid.UUID, environmentID uuid.UUID) ([]*ent.Service, error) {
	services, err := self.base.DB.Service.Query().
		Where(service.IDIn(serviceIDs...), service.EnvironmentID(environmentID)).
		All(ctx)

	if err != nil {
		return nil, err
	}

	return services, nil
}

func (self *ServiceRepository) GetByName(ctx context.Context, name string) (*ent.Service, error) {
	return self.base.DB.Service.Query().
		Where(service.NameEQ(name)).
		WithServiceGroup().
		WithEnvironment(func(eq *ent.EnvironmentQuery) {
			eq.WithProject(func(pq *ent.ProjectQuery) {
				pq.WithTeam()
			})
		}).
		Only(ctx)
}

func (self *ServiceRepository) GetDatabaseType(ctx context.Context, serviceID uuid.UUID) (string, error) {
	svc, err := self.base.DB.Service.Query().
		Where(service.IDEQ(serviceID)).
		Only(ctx)
	if err != nil {
		return "", err
	}
	if svc.Database == nil {
		return "", nil
	}
	return *svc.Database, nil
}

func (self *ServiceRepository) GetDatabases(ctx context.Context) ([]*ent.Service, error) {
	return self.base.DB.Service.Query().
		Where(service.TypeEQ(schema.ServiceTypeDatabase)).
		WithServiceConfig().
		// Kinda janky we have to go all the way down to get the namespace
		WithEnvironment(
			func(eq *ent.EnvironmentQuery) {
				eq.WithProject(func(pq *ent.ProjectQuery) {
					pq.WithTeam()
				})
			},
		).
		Order(ent.Desc(service.FieldCreatedAt)).
		All(ctx)
}

func (self *ServiceRepository) GetByInstallationIDAndRepoName(ctx context.Context, installationID int64, repoName string) ([]*ent.Service, error) {
	return self.base.DB.Service.Query().
		Where(service.GithubInstallationIDEQ(installationID)).
		Where(service.GitRepositoryEQ(repoName)).
		WithServiceConfig().
		WithCurrentDeployment().
		Order(ent.Desc(service.FieldCreatedAt)).
		All(ctx)
}

func (self *ServiceRepository) GetByEnvironmentID(ctx context.Context, environmentID uuid.UUID, authPredicate predicate.Service, withLatestDeployment bool) ([]*ent.Service, error) {
	q := self.base.DB.Service.Query().
		Where(service.EnvironmentIDEQ(environmentID)).
		WithServiceGroup().
		WithServiceConfig().
		WithCurrentDeployment().
		WithTemplate().
		Order(ent.Desc(service.FieldCreatedAt))

	if authPredicate != nil {
		q = q.Where(authPredicate)
	}

	services, err := q.All(ctx)
	if err != nil {
		return nil, err
	}

	if withLatestDeployment {
		// Get the latest deployment for each service
		for _, svc := range services {
			latestDeployment, err := self.base.DB.Deployment.Query().
				Where(deployment.ServiceIDEQ(svc.ID)).
				Order(ent.Desc(deployment.FieldCreatedAt)).
				Limit(1).
				First(ctx)

			if err != nil && !ent.IsNotFound(err) {
				return nil, err
			}

			if latestDeployment != nil {
				svc.Edges.Deployments = []*ent.Deployment{latestDeployment}
				if latestDeployment.Status != schema.DeploymentStatusBuildSucceeded {
					// Get last successful deployment if the latest one is not successful
					lastSuccessfulDeployment, err := self.deploymentRepo.GetLastSuccessfulDeployment(ctx, svc.ID)
					if err != nil && !ent.IsNotFound(err) {
						return nil, err
					}
					if !ent.IsNotFound(err) {
						svc.Edges.Deployments = append(svc.Edges.Deployments, lastSuccessfulDeployment)
					}
				}
			}
		}
	}

	return services, nil
}

func (self *ServiceRepository) GetGithubPrivateKey(ctx context.Context, serviceID uuid.UUID) (string, error) {
	svc, err := self.base.DB.Service.Query().
		Where(service.IDEQ(serviceID)).
		Only(ctx)
	if err != nil {
		return "", err
	}

	if svc.GithubInstallationID == nil {
		return "", nil
	}

	app, err := self.base.DB.GithubInstallation.Query().
		Where(githubinstallation.IDEQ(*svc.GithubInstallationID)).
		QueryGithubApp().
		Select(githubapp.FieldPrivateKey).
		Only(ctx)
	if err != nil {
		return "", err
	}

	return app.PrivateKey, nil
}

func (self *ServiceRepository) CountDomainCollisons(ctx context.Context, tx repository.TxInterface, domain string, excludingServiceID *uuid.UUID) (int, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	// Convert the domain to lowercase for case-insensitive comparison
	lowerDomain := strings.ToLower(domain)

	// Get all services with non-empty hosts JSON field
	q := db.ServiceConfig.Query().
		Where(
			serviceconfig.HostsNotNil(),
		)
	if excludingServiceID != nil {
		q = q.Where(serviceconfig.ServiceIDNEQ(*excludingServiceID))
	}
	configs, err := q.
		All(ctx)

	if err != nil {
		// Return just the legacy count if we can't query the hosts field
		return 0, nil
	}

	// Count matches in the hosts field manually
	jsonCount := 0
	for _, config := range configs {
		// Skip empty hosts field
		if len(config.Hosts) == 0 {
			continue
		}

		// Check each host in the array
		for _, host := range config.Hosts {
			if strings.EqualFold(host.Host, lowerDomain) {
				jsonCount++
				break
			}
		}
	}

	return jsonCount, nil
}

func (self *ServiceRepository) GetDeploymentNamespace(ctx context.Context, serviceID uuid.UUID) (string, error) {
	svc, err := self.base.DB.Service.Query().
		Where(service.IDEQ(serviceID)).
		QueryEnvironment().
		QueryProject().
		QueryTeam().Select(team.FieldNamespace).
		Only(ctx)
	if err != nil {
		return "", err
	}
	return svc.Namespace, nil
}

// Summarize services in environment
func (self *ServiceRepository) SummarizeServices(ctx context.Context, environmentIDs []uuid.UUID) (counts map[uuid.UUID]int, icons map[uuid.UUID][]string, err error) {
	counts = make(map[uuid.UUID]int)

	// Maps to not duplicate icons
	iconSets := make(map[uuid.UUID]map[string]struct{})

	// Initialize sets for each environment ID
	for _, envID := range environmentIDs {
		iconSets[envID] = make(map[string]struct{})
	}

	services, err := self.base.DB.Service.Query().
		Select(service.FieldEnvironmentID).
		Where(service.EnvironmentIDIn(environmentIDs...)).
		WithServiceConfig().
		All(ctx)
	if err != nil {
		return
	}

	for _, svc := range services {
		counts[svc.EnvironmentID]++

		if svc.Edges.ServiceConfig == nil {
			continue
		}

		if svc.Edges.ServiceConfig.Icon != "" {
			iconSets[svc.EnvironmentID][string(svc.Edges.ServiceConfig.Icon)] = struct{}{}
			continue
		}
	}

	// Convert to slices
	icons = make(map[uuid.UUID][]string)

	for envID, iconSet := range iconSets {
		for icon := range iconSet {
			icons[envID] = append(icons[envID], icon)
		}
		// Sort providers
		slices.Sort(icons[envID])
	}

	return counts, icons, nil
}

// See if a service needs a new deployment
type NeedsDeploymentResponse string

const (
	NeedsBuildAndDeployment NeedsDeploymentResponse = "needs_build_and_deployment"
	NeedsDeployment         NeedsDeploymentResponse = "needs_deployment"
	NoDeploymentNeeded      NeedsDeploymentResponse = "no_deployment_needed"
)

func (self *ServiceRepository) NeedsDeployment(ctx context.Context, service *ent.Service) (NeedsDeploymentResponse, error) {
	if service.Edges.CurrentDeployment == nil || service.Edges.CurrentDeployment.ResourceDefinition == nil {
		return NoDeploymentNeeded, nil
	}

	// Re-consider CurrentDeployment if one is currently being built
	activeBuilds, err := self.base.DB.Deployment.Query().
		Where(
			deployment.ServiceIDEQ(service.ID),
			deployment.StatusIn(schema.DeploymentStatusBuildPending, schema.DeploymentStatusBuildQueued, schema.DeploymentStatusBuildRunning),
		).Order(ent.Desc(deployment.FieldCreatedAt)).
		Limit(1).
		All(ctx)
	if err != nil {
		log.Errorf("Failed to query active builds for service %s: %v", service.ID, err)
	} else {
		if len(activeBuilds) > 0 {
			service.Edges.CurrentDeployment = activeBuilds[0]
		}
	}
	// See if a deployment is needed
	// Create a an object with only fields we care to compare
	if service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.Volumes == nil {
		service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.Volumes = []v1.VolumeSpec{}
	}
	existingCrd := &v1.Service{
		Spec: v1.ServiceSpec{
			Builder: service.Edges.CurrentDeployment.ResourceDefinition.Spec.Builder,
			Config: v1.ServiceConfigSpec{
				GitBranch:      service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.GitBranch,
				Hosts:          service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.Hosts,
				Replicas:       service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.Replicas,
				Ports:          service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.Ports,
				RunCommand:     service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.RunCommand,
				Public:         service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.Public,
				Volumes:        service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.Volumes,
				HealthCheck:    service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.HealthCheck,
				VariableMounts: service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.VariableMounts,
			},
		},
	}
	// Create a new CRD to compare it
	var gitBranch string
	if service.Edges.ServiceConfig.GitBranch != nil {
		gitBranch = *service.Edges.ServiceConfig.GitBranch
		if !strings.HasPrefix(gitBranch, "refs/heads/") {
			gitBranch = fmt.Sprintf("refs/heads/%s", gitBranch)
		}
	}
	var healthCheck *v1.HealthCheckSpec
	if service.Edges.ServiceConfig.HealthCheck != nil {
		healthCheck = service.Edges.ServiceConfig.HealthCheck.AsV1HealthCheck()
	}
	var variableMounts []v1.VariableMountSpec
	if len(service.Edges.ServiceConfig.VariableMounts) > 0 {
		variableMounts = schema.AsV1VariableMounts(service.Edges.ServiceConfig.VariableMounts)
	}
	newCrd := &v1.Service{
		Spec: v1.ServiceSpec{
			Builder: string(service.Edges.ServiceConfig.Builder),
			Config: v1.ServiceConfigSpec{
				GitBranch:      gitBranch,
				Hosts:          schema.AsV1HostSpecs(service.Edges.ServiceConfig.Hosts),
				Replicas:       utils.ToPtr(service.Edges.ServiceConfig.Replicas),
				Ports:          schema.AsV1PortSpecs(service.Edges.ServiceConfig.Ports),
				RunCommand:     service.Edges.ServiceConfig.RunCommand,
				Public:         service.Edges.ServiceConfig.IsPublic,
				Volumes:        schema.AsV1Volumes(service.Edges.ServiceConfig.Volumes),
				HealthCheck:    healthCheck,
				VariableMounts: variableMounts,
			},
		},
	}

	// Changing builder requires a new build
	if existingCrd.Spec.Builder != newCrd.Spec.Builder {
		return NeedsBuildAndDeployment, nil
	}

	// Branch needs a new build
	if existingCrd.Spec.Config.GitBranch != newCrd.Spec.Config.GitBranch {
		return NeedsBuildAndDeployment, nil
	}

	// Just update the custom resource
	if !reflect.DeepEqual(existingCrd, newCrd) {
		return NeedsDeployment, nil
	}

	return NoDeploymentNeeded, nil
}

// See if volume is in use
func (self *ServiceRepository) IsVolumeInUse(ctx context.Context, volumeName string) (bool, error) {
	// ! TODO - figure out how to use sqljson rather than go filtering
	services, err := self.base.DB.ServiceConfig.Query().
		Where(
			serviceconfig.VolumesNotNil(),
		).
		All(ctx)
	if err != nil {
		return false, err
	}
	for _, svc := range services {
		for _, volume := range svc.Volumes {
			if volume.ID == volumeName {
				return true, nil
			}
		}
	}
	return false, nil
}

// Get services using a PVC
func (self *ServiceRepository) GetServicesUsingPVC(ctx context.Context, pvcID string) ([]*ent.Service, error) {
	// Use the same approach as IsVolumeInUse since the sqljson approach isn't working correctly
	serviceConfigs, err := self.base.DB.ServiceConfig.Query().
		Where(
			serviceconfig.VolumesNotNil(),
		).
		WithService().
		All(ctx)
	if err != nil {
		return nil, err
	}

	var services []*ent.Service
	for _, svcConfig := range serviceConfigs {
		if len(svcConfig.Volumes) == 0 {
			continue
		}

		for _, volume := range svcConfig.Volumes {
			if volume.ID == pvcID {
				services = append(services, svcConfig.Edges.Service)
				break // Found in this service, no need to check other volumes
			}
		}
	}

	return services, nil
}

// Get PVC mount paths by IDs
func (self *ServiceRepository) GetPVCMountPaths(ctx context.Context, pvcs []*models.PVCInfo) (map[string]string, error) {
	mountPaths := make(map[string]string)

	// Query all services that use these PVCs
	pvcIDs := make([]string, len(pvcs))
	for i, pvc := range pvcs {
		pvcIDs[i] = pvc.ID
	}
	// ! TODO - figure out how to use sqljson rather than go filtering
	serviceConfigs, err := self.base.DB.ServiceConfig.Query().
		Where(
			serviceconfig.VolumesNotNil(),
		).
		All(ctx)
	if err != nil {
		return nil, err
	}

	for _, svcConfig := range serviceConfigs {
		if len(svcConfig.Volumes) == 0 {
			continue
		}

		for _, volume := range svcConfig.Volumes {
			if volume.ID == "" || !slices.Contains(pvcIDs, volume.ID) {
				continue
			}
			mountPaths[volume.ID] = volume.MountPath
		}
	}

	// Process database PVCs
	var databaseServiceIDs []uuid.UUID
	for _, pvc := range pvcs {
		if pvc.IsDatabase && pvc.MountedOnServiceID != nil {
			databaseServiceIDs = append(databaseServiceIDs, *pvc.MountedOnServiceID)
		}
	}

	// Query services that have database PVCs mounted
	if len(databaseServiceIDs) > 0 {
		databaseServices, err := self.base.DB.Service.Query().
			Select(service.FieldDatabase).
			Where(service.IDIn(databaseServiceIDs...), service.DatabaseNotNil()).
			All(ctx)
		if err != nil {
			return nil, err
		}

		for _, svc := range databaseServices {
			mountPath := utils.InferOperatorPVCMountPath(*svc.Database)
			if mountPath == nil {
				mountPath = utils.ToPtr("/database")
			}

			// Attach to PVC
			for i := range pvcs {
				if pvcs[i].MountedOnServiceID != nil && *pvcs[i].MountedOnServiceID == svc.ID {
					mountPaths[pvcs[i].ID] = *mountPath
				}
			}
		}
	}

	return mountPaths, nil
}

// Get database config for a service
func (self *ServiceRepository) GetDatabaseConfig(ctx context.Context, serviceID uuid.UUID) (*schema.DatabaseConfig, error) {
	svcConfig, err := self.base.DB.Service.Query().
		Where(service.IDEQ(serviceID)).
		QueryServiceConfig().
		Select(serviceconfig.FieldDatabaseConfig).
		Only(ctx)
	if err != nil {
		return nil, err
	}

	return svcConfig.DatabaseConfig, nil
}
