package service_service

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/names"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	"github.com/unbindapp/unbind-api/internal/watchpaths"
	"k8s.io/apimachinery/pkg/api/resource"
)

// databasePortsWithNodePorts returns a copy of ports with one external node port set
// per port. A database speaking two protocols needs one allocated port each.
func databasePortsWithNodePorts(ports []schema.PortSpec, nodePorts []int32) []schema.PortSpec {
	out := make([]schema.PortSpec, len(ports))
	for i, port := range ports {
		port.IsNodePort = i < len(nodePorts)
		port.NodePort = nil
		if port.IsNodePort {
			port.NodePort = new(nodePorts[i])
		}
		out[i] = port
	}
	return out
}

// A service left without domains is private
func removesLastHost(existing []schema.HostSpec, input *models.UpdateServiceInput) bool {
	if len(existing) == 0 || len(input.RemoveHosts) == 0 {
		return false
	}
	return len(service_repo.MergeHosts(existing, input.OverwriteHosts, input.UpsertHosts, input.RemoveHosts)) == 0
}

// serviceUpdate is a validated update, ready to apply
type serviceUpdate struct {
	input   *models.UpdateServiceInput
	service *ent.Service
	// source is set when the service moves to another repository
	source *githubSource
}

// UpdateService updates a service and its configuration, rolling it out when needed
func (self *ServiceService) UpdateService(ctx context.Context, requesterUserID uuid.UUID, input *models.UpdateServiceInput) (*models.ServiceResponse, error) {
	update, err := self.prepareServiceUpdate(ctx, requesterUserID, input)
	if err != nil {
		return nil, err
	}

	updated, err := self.applyServiceUpdate(ctx, update)
	if err != nil {
		return nil, err
	}

	touched := touchedServices{}
	self.touchServiceConfig(ctx, touched, updated, update.service.Edges.ServiceConfig, updated.Edges.ServiceConfig)
	results, err := self.rollout(ctx, touched)
	if err != nil {
		return nil, err
	}

	service := results[input.ServiceID].service
	newDeployment := results[input.ServiceID].deployment
	if newDeployment != nil {
		if newDeployment.Status == schema.DeploymentStatusBuildSucceeded {
			service.Edges.CurrentDeployment = newDeployment
		}
		service.Edges.Deployments = []*ent.Deployment{newDeployment}
	}

	go self.notifyServiceUpdated(requesterUserID, input, service, newDeployment)

	return self.updatedServiceResponse(ctx, requesterUserID, service)
}

// prepareServiceUpdate runs every check that does not touch anything
func (self *ServiceService) prepareServiceUpdate(ctx context.Context, requesterUserID uuid.UUID, input *models.UpdateServiceInput) (*serviceUpdate, error) {
	if input.GitTag != nil && !utils.IsValidGlobPattern(*input.GitTag) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid git tag")
	}

	if input.WatchPaths != nil {
		cleaned, err := watchpaths.Clean(*input.WatchPaths)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}
		input.WatchPaths = &cleaned
	}

	if err := input.Resources.Validate(); err != nil {
		return nil, err
	}

	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to admin service
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.ServiceID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	_, _, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	service, err := self.repo.Service().GetByID(ctx, input.ServiceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
		}
		return nil, err
	}

	if err := self.cleanServiceRename(ctx, input, service); err != nil {
		return nil, err
	}

	if err := validateSourceUpdate(service.Type, input); err != nil {
		return nil, err
	}
	source, err := self.prepareSourceChange(ctx, service, input)
	if err != nil {
		return nil, err
	}

	if hasBackupInput(input.S3BackupBucketID, input.BackupSchedule, input.BackupRetentionCount) {
		if err := self.validateServiceSupportsBackups(ctx, service); err != nil {
			return nil, err
		}
	}

	if input.Builder != nil && (service.Type == schema.ServiceTypeDockerimage || service.Type == schema.ServiceTypeDatabase) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Cannot update builder for docker image or database service")
	}

	// For database we don't want to set ports
	if service.Type == schema.ServiceTypeDatabase {
		input.OverwritePorts = nil
		input.AddPorts = nil

		// Check backup schedule
		if input.BackupSchedule != nil {
			if err := utils.ValidateCronExpression(*input.BackupSchedule); err != nil {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("invalid backup schedule: %s", err))
			}
		}

		if err := validateDatabaseVolumeInput(service, input.OverwriteVolumes, input.AddVolumes, input.RemoveVolumes, input.Replicas); err != nil {
			return nil, err
		}
	}

	// databases mount at the path their engine expects, the caller only names the volume
	if service.Type != schema.ServiceTypeDatabase {
		for _, volume := range slices.Concat(input.OverwriteVolumes, input.AddVolumes) {
			if !utils.IsValidUnixPath(volume.MountPath) {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid volume mount path")
			}
		}
	}

	// A database with an existing deployment can't change its version.
	if service.Type == schema.ServiceTypeDatabase &&
		input.DatabaseConfig != nil &&
		service.DatabaseVersion != nil &&
		len(service.Edges.Deployments) > 0 &&
		input.DatabaseConfig.Version != "" &&
		input.DatabaseConfig.Version != *service.DatabaseVersion {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Cannot update version for database service with existing deployment")
	}

	// Verify storage size changes if applicable
	if input.DatabaseConfig != nil {
		if input.DatabaseConfig.StorageSize == "" {
			// Set to existing
			if service.Edges.ServiceConfig.DatabaseConfig != nil {
				input.DatabaseConfig.StorageSize = service.Edges.ServiceConfig.DatabaseConfig.StorageSize
				// Sort of a DB migration I guess
				if input.DatabaseConfig.StorageSize == "" {
					input.DatabaseConfig.StorageSize = "1Gi"
				}
			}
		} else {
			// Parse
			newSizeTarget, err := utils.ParseStorageQuantity(input.DatabaseConfig.StorageSize)
			if err != nil {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
			}
			input.DatabaseConfig.StorageSize = newSizeTarget.String()

			// Parse existing (if present)
			if service.Edges.ServiceConfig.DatabaseConfig != nil && service.Edges.ServiceConfig.DatabaseConfig.StorageSize != "" {
				existingSizeTarget, err := utils.ParseStorageQuantity(service.Edges.ServiceConfig.DatabaseConfig.StorageSize)
				if err != nil {
					existingSizeTarget = resource.MustParse("1Gi")
				}
				// Compare
				if newSizeTarget.Cmp(existingSizeTarget) < 0 {
					return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Cannot decrease storage size")
				}
			}
		}
		input.DatabaseConfig = schema.MergeDatabaseConfig(service.Edges.ServiceConfig.DatabaseConfig, input.DatabaseConfig)
	}

	if service.Type == schema.ServiceTypeDatabase && service.Database != nil {
		databaseConfig := input.DatabaseConfig
		if databaseConfig == nil {
			databaseConfig = service.Edges.ServiceConfig.DatabaseConfig
		}
		resources := schema.MergeResources(service.Edges.ServiceConfig.Resources, input.Resources)
		if err := databaseConfig.ValidateMemorySettings(*service.Database, resources); err != nil {
			return nil, err
		}
	}

	client := self.k8s.GetInternalClient()

	// Check if PVC is in use by a service
	for _, volume := range input.OverwriteVolumes {
		err = self.validatePVC(ctx, input.TeamID, input.ProjectID, input.EnvironmentID, volume.ID, service.Edges.Environment.Edges.Project.Edges.Team.Namespace, client)
		if err != nil {
			return nil, err
		}
	}
	for _, volume := range input.AddVolumes {
		err = self.validatePVC(ctx, input.TeamID, input.ProjectID, input.EnvironmentID, volume.ID, service.Edges.Environment.Edges.Project.Edges.Team.Namespace, client)
		if err != nil {
			return nil, err
		}
	}

	// Make sure we can read and write to the backup bucket (for databases)
	if service.Type == schema.ServiceTypeDatabase &&
		input.S3BackupBucketID != nil &&
		*input.S3BackupBucketID != uuid.Nil {
		if err := self.verifyS3BackupBucket(ctx, *input.S3BackupBucketID, service.Edges.Environment.Edges.Project.Edges.Team, client); err != nil {
			return nil, err
		}
	}

	return &serviceUpdate{input: input, service: service, source: source}, nil
}

// applyServiceUpdate persists a prepared update without rolling it out and returns
// the service as stored
func (self *ServiceService) applyServiceUpdate(ctx context.Context, update *serviceUpdate) (*ent.Service, error) {
	input, service := update.input, update.service
	client := self.k8s.GetInternalClient()

	if err := self.applyDatabaseStorageSize(ctx, service, input.DatabaseConfig, client); err != nil {
		return nil, err
	}

	var detected *detectedSource
	if update.source != nil {
		result, err := self.analyzeGithubSource(ctx, update.source, *input.GitBranch, analysisTarget(service.Edges.ServiceConfig, input))
		if err != nil {
			return nil, err
		}
		detected = new(summarizeAnalysis(service.Type, result))
	}

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if err := self.repo.Service().Update(ctx, tx, input.ServiceID, input.Name, input.Description); err != nil {
			return errdefs.NewInternalError(err, "Failed to save the service")
		}
		if update.source != nil {
			if err := self.repo.Service().UpdateGitSource(ctx, tx, input.ServiceID, update.source.installation.ID, update.source.ownerLogin, update.source.repoName, detected.ports); err != nil {
				return errdefs.NewInternalError(err, "Failed to save the service's repository")
			}
		}

		// Toggling a database public/private manages its L4 host and allocated port.
		if service.Type == schema.ServiceTypeDatabase && input.IsPublic != nil {
			existingPorts := service.Edges.ServiceConfig.Ports
			if *input.IsPublic {
				alreadyExposed := false
				for _, port := range existingPorts {
					if port.IsNodePort {
						alreadyExposed = true
						break
					}
				}
				hasIncomingHost := len(input.OverwriteHosts) > 0 || len(input.UpsertHosts) > 0
				if !alreadyExposed && !hasIncomingHost && len(existingPorts) > 0 {
					databaseHosts, nodePorts, err := self.prepareDatabaseExposure(ctx, tx, service.KubernetesName, existingPorts)
					if err != nil {
						return err
					}
					if len(nodePorts) == 0 {
						input.IsPublic = new(false)
					} else {
						input.OverwriteHosts = append(input.OverwriteHosts, databaseHosts...)
						input.OverwritePorts = databasePortsWithNodePorts(existingPorts, nodePorts)
					}
				}
			} else {
				input.RemoveHosts = append(input.RemoveHosts, service.Edges.ServiceConfig.Hosts...)
				input.OverwritePorts = databasePortsWithNodePorts(existingPorts, nil)
			}
		}

		if len(service.Edges.ServiceConfig.Hosts) < 1 &&
			input.IsPublic != nil && *input.IsPublic && len(input.OverwriteHosts) < 1 && len(input.UpsertHosts) < 1 && service.Type != schema.ServiceTypeDatabase &&
			(len(input.OverwritePorts) > 0 || len(input.AddPorts) > 0 || len(service.Edges.ServiceConfig.Ports) > 0) {

			// Figure out ports
			var ports []schema.PortSpec
			if len(input.OverwritePorts) > 0 {
				ports = input.OverwritePorts
			} else if len(input.AddPorts) > 0 {
				ports = input.AddPorts
			}

			if len(service.Edges.ServiceConfig.Ports) > 0 {
				ports = append(ports, service.Edges.ServiceConfig.Ports...)
			}

			generatedHost, err := self.generateWildcardHost(ctx, tx, service.KubernetesName, ports)
			if err != nil {
				return errdefs.NewInternalError(err, "Failed to generate a domain for this service")
			}
			if generatedHost == nil {
				input.IsPublic = new(false)
			} else {
				input.OverwriteHosts = append(input.OverwriteHosts, *generatedHost)
			}
		}
		// Validate hosts
		var hostCollisionsToCheck []schema.HostSpec
		hostCollisionsToCheck = append(hostCollisionsToCheck, input.OverwriteHosts...)
		hostCollisionsToCheck = append(hostCollisionsToCheck, input.UpsertHosts...)
		for _, host := range hostCollisionsToCheck {
			// Count domain collisions
			domainCount, err := self.repo.Service().CountDomainCollisons(ctx, tx, host.Host, new(service.ID))
			if err != nil {
				return errdefs.NewInternalError(err, "Failed to check the domain for collisions")
			}
			if domainCount > 0 {
				return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("domain %s already in use", host.Host))
			}
		}

		// Determine is public (databases manage this explicitly via the toggle above)
		if service.Type != schema.ServiceTypeDatabase {
			hasPorts := len(input.OverwritePorts) > 0 || len(input.AddPorts) > 0 || len(service.Edges.ServiceConfig.Ports) > 0
			switch {
			case removesLastHost(service.Edges.ServiceConfig.Hosts, input):
				input.IsPublic = new(false)
			case hasPorts && (len(input.OverwriteHosts) > 0 || len(input.UpsertHosts) > 0 || len(service.Edges.ServiceConfig.Hosts) > 0):
				input.IsPublic = new(true)
			}
		}

		// Validate health check if updating
		if input.HealthCheck != nil {
			// Copy data from existing
			if service.Edges.ServiceConfig.HealthCheck != nil {
				if input.HealthCheck.Type == nil {
					input.HealthCheck.Type = service.Edges.ServiceConfig.HealthCheck.Type
				}
				if input.HealthCheck.Path == "" {
					input.HealthCheck.Path = service.Edges.ServiceConfig.HealthCheck.Path
				}
				if input.HealthCheck.Command == "" {
					input.HealthCheck.Command = service.Edges.ServiceConfig.HealthCheck.Command
				}
				if input.HealthCheck.Port == nil {
					input.HealthCheck.Port = service.Edges.ServiceConfig.HealthCheck.Port
				}
				if input.HealthCheck.StartupPeriodSeconds == nil {
					input.HealthCheck.StartupPeriodSeconds = service.Edges.ServiceConfig.HealthCheck.StartupPeriodSeconds
				} else if *input.HealthCheck.StartupPeriodSeconds < 1 {
					// Setting these to nil will cause the default values to be used
					input.HealthCheck.StartupPeriodSeconds = nil
				}
				if input.HealthCheck.StartupTimeoutSeconds == nil {
					input.HealthCheck.StartupTimeoutSeconds = service.Edges.ServiceConfig.HealthCheck.StartupTimeoutSeconds
				} else if *input.HealthCheck.StartupTimeoutSeconds < 1 {
					input.HealthCheck.StartupTimeoutSeconds = nil
				}
				if input.HealthCheck.StartupFailureThreshold == nil {
					input.HealthCheck.StartupFailureThreshold = service.Edges.ServiceConfig.HealthCheck.StartupFailureThreshold
				} else if *input.HealthCheck.StartupFailureThreshold < 1 {
					input.HealthCheck.StartupFailureThreshold = nil
				}
				if input.HealthCheck.HealthPeriodSeconds == nil {
					input.HealthCheck.HealthPeriodSeconds = service.Edges.ServiceConfig.HealthCheck.HealthPeriodSeconds
				} else if *input.HealthCheck.HealthPeriodSeconds < 1 {
					input.HealthCheck.HealthPeriodSeconds = nil
				}
				if input.HealthCheck.HealthTimeoutSeconds == nil {
					input.HealthCheck.HealthTimeoutSeconds = service.Edges.ServiceConfig.HealthCheck.HealthTimeoutSeconds
				} else if *input.HealthCheck.HealthTimeoutSeconds < 1 {
					input.HealthCheck.HealthTimeoutSeconds = nil
				}
				if input.HealthCheck.HealthFailureThreshold == nil {
					input.HealthCheck.HealthFailureThreshold = service.Edges.ServiceConfig.HealthCheck.HealthFailureThreshold
				} else if *input.HealthCheck.HealthFailureThreshold < 1 {
					input.HealthCheck.HealthFailureThreshold = nil
				}
			}
			if input.HealthCheck.Port == nil && len(service.Edges.ServiceConfig.Ports) > 0 {
				for _, port := range service.Edges.ServiceConfig.Ports {
					if port.Protocol == nil || *port.Protocol == schema.ProtocolTCP {
						input.HealthCheck.Port = new(port.Port)
						break
					}
				}
			}
			if err := input.HealthCheck.Validate(); err != nil {
				return err
			}
		}

		if service.Type == schema.ServiceTypeDatabase {
			overwrite, remove, err := self.resolveDatabaseVolumeChange(ctx, tx, service, input, client)
			if err != nil {
				return err
			}
			input.OverwriteVolumes = overwrite
			input.RemoveVolumes = remove
			input.AddVolumes = nil
		}

		updateInput := &service_repo.MutateConfigInput{
			ServiceID:                     input.ServiceID,
			Builder:                       input.Builder,
			GitBranch:                     input.GitBranch,
			GitTag:                        input.GitTag,
			WatchPaths:                    input.WatchPaths,
			AddPorts:                      input.AddPorts,
			RemovePorts:                   input.RemovePorts,
			OverwritePorts:                input.OverwritePorts,
			OverwriteHosts:                input.OverwriteHosts,
			UpsertHosts:                   input.UpsertHosts,
			RemoveHosts:                   input.RemoveHosts,
			Replicas:                      input.Replicas,
			AutoDeploy:                    input.AutoDeploy,
			RailpackBuilderInstallCommand: input.RailpackBuilderInstallCommand,
			RailpackBuilderBuildCommand:   input.RailpackBuilderBuildCommand,
			RunCommand:                    input.RunCommand,
			Public:                        input.IsPublic,
			Image:                         input.Image,
			DockerBuilderDockerfilePath:   input.DockerBuilderDockerfilePath,
			DockerBuilderBuildContext:     input.DockerBuilderBuildContext,
			DatabaseConfig:                input.DatabaseConfig,
			S3BackupBucketID:              input.S3BackupBucketID,
			BackupSchedule:                input.BackupSchedule,
			BackupRetentionCount:          input.BackupRetentionCount,
			OverwriteVolumes:              input.OverwriteVolumes,
			AddVolumes:                    input.AddVolumes,
			RemoveVolumes:                 input.RemoveVolumes,
			HealthCheck:                   input.HealthCheck,
			OverwriteVariableMounts:       input.OverwriteVariableMounts,
			AddVariableMounts:             input.AddVariableMounts,
			RemoveVariableMounts:          input.RemoveVariableMounts,
			InitContainers:                input.InitContainers,
			Resources:                     input.Resources,
		}
		if detected != nil {
			updateInput.Provider = new(detected.provider)
			updateInput.Framework = new(detected.framework)
			updateInput.Icon = new(detected.icon)
		}
		if err := self.repo.Service().UpdateConfig(ctx, tx, updateInput); err != nil {
			return errdefs.NewInternalError(err, "Failed to save the service configuration")
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return self.repo.Service().GetByID(ctx, service.ID)
}

func (self *ServiceService) notifyServiceUpdated(requesterUserID uuid.UUID, input *models.UpdateServiceInput, updated *ent.Service, newDeployment *ent.Deployment) {
	{
		event := schema.WebhookEventServiceUpdated
		level := webhooks_service.WebhookLevelInfo

		service, err := self.repo.Service().GetByID(context.Background(), updated.ID)
		if err != nil {
			log.Errorf("Failed to get service %s: %v", updated.ID.String(), err)
			return
		}

		basePath, _ := utils.JoinURLPaths(
			self.cfg.ExternalUIUrl,
			input.TeamID.String(),
			"project",
			input.ProjectID.String(),
		)
		url := basePath + "?environment=" + input.EnvironmentID.String() +
			"&service=" + service.ID.String()
		user, err := self.repo.User().GetByID(context.Background(), requesterUserID)
		if err != nil {
			log.Errorf("Failed to get user %s: %v", requesterUserID.String(), err)
			return
		}
		data := webhooks_service.WebhookData{
			Title: "Service Updated",
			Url:   url,
			Fields: []webhooks_service.WebhookDataField{
				{
					Name:  "Service Name",
					Value: service.Name,
				},
				{
					Name:  "Project & Environment",
					Value: fmt.Sprintf("%s > %s", service.Edges.Environment.Edges.Project.Name, service.Edges.Environment.Name),
				},
				{
					Name:  "Updated By",
					Value: user.Email,
				},
			},
		}

		if input.RepositoryName != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Repository",
				Value: *input.RepositoryOwner + "/" + *input.RepositoryName,
			})
		}

		if input.GitBranch != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Git Branch",
				Value: *input.GitBranch,
			})
		}

		if input.Image != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Image",
				Value: *input.Image,
			})
		}

		if input.Replicas != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Replicas",
				Value: fmt.Sprintf("%d", *input.Replicas),
			})
		}

		if input.AutoDeploy != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Auto Deploy",
				Value: fmt.Sprintf("%t", *input.AutoDeploy),
			})
		}

		if input.RunCommand != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Run Command",
				Value: *input.RunCommand,
			})
		}

		if input.IsPublic != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Public",
				Value: fmt.Sprintf("%t", *input.IsPublic),
			})
		}

		if input.DockerBuilderDockerfilePath != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Dockerfile Path",
				Value: *input.DockerBuilderDockerfilePath,
			})
		}

		if input.DockerBuilderBuildContext != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Dockerfile Context",
				Value: *input.DockerBuilderBuildContext,
			})
		}

		if len(service.Edges.ServiceConfig.Hosts) > 0 {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Service URL",
				Value: fmt.Sprintf("https://%s", service.Edges.ServiceConfig.Hosts[0].Host),
			})
		}

		if newDeployment != nil {
			deploymentUrl, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, input.TeamID.String(), "project", input.ProjectID.String(), "?environment="+input.EnvironmentID.String(), "&service="+service.ID.String(), "&deployment="+newDeployment.ID.String())
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Deployment",
				Value: deploymentUrl,
			})
		}

		if err := self.webhookService.TriggerWebhooks(context.Background(), level, event, data, input.TeamID, input.ProjectID); err != nil {
			log.Errorf("Failed to trigger webhook %s: %v", event, err)
		}
	}
}

func (self *ServiceService) updatedServiceResponse(ctx context.Context, requesterUserID uuid.UUID, service *ent.Service) (*models.ServiceResponse, error) {
	team := service.Edges.Environment.Edges.Project.Edges.Team
	volumeMap, err := self.GetVolumesForServices(ctx, team.Namespace, team.ID, []*ent.Service{service})
	if err != nil {
		return nil, err
	}

	permSet, err := self.repo.Permissions().GetUserPermissionSet(ctx, requesterUserID)
	if err != nil {
		return nil, err
	}

	resp := models.TransformServiceEntity(service)
	resp.Permissions = permSet.ServiceActions(team.ID, service.Edges.Environment.ProjectID, service.EnvironmentID, service.ID)

	if volume, ok := volumeMap[service.ID]; ok {
		resp.Config.Volumes = volume
	}

	return resp, nil
}

func (self *ServiceService) cleanServiceRename(ctx context.Context, input *models.UpdateServiceInput, service *ent.Service) error {
	if input.Name == nil {
		return nil
	}

	name, err := names.Clean(*input.Name)
	if err != nil {
		return err
	}
	input.Name = &name
	if name == service.Name {
		return nil
	}

	takenNames, err := self.repo.Service().GetNamesByEnvironment(ctx, nil, service.EnvironmentID)
	if err != nil {
		return err
	}
	return names.EnsureFree(name, takenNames, "service", "environment")
}
