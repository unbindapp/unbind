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
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	"k8s.io/apimachinery/pkg/api/resource"
)

// databasePortsWithNodePort returns a copy of ports with the external node port set
// (public) or stripped (private). The container port is always preserved.
func databasePortsWithNodePort(ports []schema.PortSpec, nodePort *int32) []schema.PortSpec {
	out := make([]schema.PortSpec, len(ports))
	for i, port := range ports {
		port.IsNodePort = nodePort != nil
		if nodePort != nil {
			port.NodePort = new(*nodePort)
		} else {
			port.NodePort = nil
		}
		out[i] = port
	}
	return out
}

// serviceUpdate is a validated update, ready to apply
type serviceUpdate struct {
	input   *models.UpdateServiceInput
	service *ent.Service
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

	return &serviceUpdate{input: input, service: service}, nil
}

// applyServiceUpdate persists a prepared update without rolling it out and returns
// the service as stored
func (self *ServiceService) applyServiceUpdate(ctx context.Context, update *serviceUpdate) (*ent.Service, error) {
	input, service := update.input, update.service
	client := self.k8s.GetInternalClient()

	if err := self.applyDatabaseStorageSize(ctx, service, input.DatabaseConfig, client); err != nil {
		return nil, err
	}

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if err := self.repo.Service().Update(ctx, tx, input.ServiceID, input.Name, input.Description); err != nil {
			return fmt.Errorf("failed to update service: %w", err)
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
					host, nodePort, err := self.prepareDatabaseExposure(ctx, tx, service.KubernetesName, existingPorts)
					if err != nil {
						return err
					}
					if nodePort == nil {
						input.IsPublic = new(false)
					} else {
						if host != nil {
							input.OverwriteHosts = append(input.OverwriteHosts, *host)
						}
						input.OverwritePorts = databasePortsWithNodePort(existingPorts, nodePort)
					}
				}
			} else {
				input.RemoveHosts = append(input.RemoveHosts, service.Edges.ServiceConfig.Hosts...)
				input.OverwritePorts = databasePortsWithNodePort(existingPorts, nil)
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
				return fmt.Errorf("failed to generate wildcard host: %w", err)
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
				return fmt.Errorf("failed to count domain collisions: %w", err)
			}
			if domainCount > 0 {
				return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("domain %s already in use", host.Host))
			}
		}

		// Determine is public (databases manage this explicitly via the toggle above)
		if service.Type != schema.ServiceTypeDatabase &&
			(len(input.OverwritePorts) > 0 || len(input.AddPorts) > 0 || len(service.Edges.ServiceConfig.Ports) > 0) {
			// Has ports, do we have hosts
			if len(input.OverwriteHosts) > 0 || len(input.UpsertHosts) > 0 || len(service.Edges.ServiceConfig.Hosts) > 0 {
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
			ProtectedVariables:            input.ProtectedVariables,
			InitContainers:                input.InitContainers,
			Resources:                     input.Resources,
		}
		if err := self.repo.Service().UpdateConfig(ctx, tx, updateInput); err != nil {
			return fmt.Errorf("failed to update service config: %w", err)
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

		if err := self.webhookService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
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
