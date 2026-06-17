package service_repo

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/serviceconfig"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

type CreateServiceInput struct {
	KubernetesName       string
	Name                 string
	ServiceType          schema.ServiceType
	Description          string
	EnvironmentID        uuid.UUID
	GitHubInstallationID *int64
	GitRepository        *string
	GitRepositoryOwner   *string
	KubernetesSecret     string
	Database             *string
	DatabaseVersion      *string
	TemplateID           *uuid.UUID
	TemplateInstanceID   *uuid.UUID
	ServiceGroupID       *uuid.UUID
	DetectedPorts        []schema.PortSpec // This is used to store detected ports, not for creation
}

// Create the service
func (self *ServiceRepository) Create(
	ctx context.Context,
	tx repository.TxInterface,
	input *CreateServiceInput,
) (*ent.Service, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Service.Create().
		SetType(input.ServiceType).
		SetKubernetesName(input.KubernetesName).
		SetName(input.Name).
		SetDescription(input.Description).
		SetEnvironmentID(input.EnvironmentID).
		SetNillableGithubInstallationID(input.GitHubInstallationID).
		SetNillableGitRepository(input.GitRepository).
		SetNillableGitRepositoryOwner(input.GitRepositoryOwner).
		SetKubernetesSecret(input.KubernetesSecret).
		SetNillableDatabase(input.Database).
		SetNillableTemplateID(input.TemplateID).
		SetNillableTemplateInstanceID(input.TemplateInstanceID).
		SetNillableServiceGroupID(input.ServiceGroupID).
		SetDetectedPorts(input.DetectedPorts).
		SetNillableDatabaseVersion(input.DatabaseVersion).Save(ctx)
}

// Create the service config
type MutateConfigInput struct {
	ServiceID                     uuid.UUID
	Builder                       *schema.ServiceBuilder
	Provider                      *enum.Provider
	Framework                     *enum.Framework
	GitBranch                     *string
	GitTag                        *string
	Icon                          *string
	OverwritePorts                []schema.PortSpec
	AddPorts                      []schema.PortSpec
	RemovePorts                   []schema.PortSpec
	OverwriteHosts                []schema.HostSpec
	UpsertHosts                   []schema.HostSpec
	RemoveHosts                   []schema.HostSpec
	Replicas                      *int32
	AutoDeploy                    *bool
	RailpackBuilderInstallCommand *string
	RailpackBuilderBuildCommand   *string
	RunCommand                    *string
	Public                        *bool
	Image                         *string
	DockerBuilderDockerfilePath   *string
	DockerBuilderBuildContext     *string
	CustomDefinitionVersion       *string
	DatabaseConfig                *schema.DatabaseConfig
	S3BackupSourceID              *uuid.UUID
	S3BackupBucket                *string
	BackupSchedule                *string
	BackupRetentionCount          *int
	SecurityContext               *schema.SecurityContext
	HealthCheck                   *schema.HealthCheck
	OverwriteVariableMounts       []*schema.VariableMount
	AddVariableMounts             []*schema.VariableMount
	RemoveVariableMounts          []*schema.VariableMount
	ProtectedVariables            *[]string
	OverwriteVolumes              []schema.ServiceVolume
	AddVolumes                    []schema.ServiceVolume
	RemoveVolumes                 []schema.ServiceVolume
	InitContainers                []*schema.InitContainer
	Resources                     *schema.Resources
}

func (self *ServiceRepository) CreateConfig(
	ctx context.Context,
	tx repository.TxInterface,
	input *MutateConfigInput,
) (*ent.ServiceConfig, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	if input == nil || input.Builder == nil {
		return nil, fmt.Errorf("builder is missing, but required")
	}

	// Get service
	service, err := db.Service.Get(ctx, input.ServiceID)
	if err != nil {
		return nil, err
	}

	// Get high level icon
	var icon string
	if input.Icon != nil {
		icon = *input.Icon
	} else if service.Database != nil {
		icon = *service.Database
	} else if input.Framework != nil {
		icon = string(*input.Framework)
	} else if input.Provider != nil {
		icon = string(*input.Provider)
	} else {
		icon = string(service.Type)
	}

	c := db.ServiceConfig.Create().
		SetServiceID(input.ServiceID).
		SetBuilder(*input.Builder).
		SetIcon(icon).
		SetNillableRailpackProvider(input.Provider).
		SetNillableRailpackFramework(input.Framework).
		SetNillableGitBranch(input.GitBranch).
		SetNillableReplicas(input.Replicas).
		SetNillableAutoDeploy(input.AutoDeploy).
		SetNillableRailpackBuilderInstallCommand(input.RailpackBuilderInstallCommand).
		SetNillableRailpackBuilderBuildCommand(input.RailpackBuilderBuildCommand).
		SetNillableRunCommand(input.RunCommand).
		SetNillableIsPublic(input.Public).
		SetNillableImage(input.Image).
		SetNillableDockerBuilderDockerfilePath(input.DockerBuilderDockerfilePath).
		SetNillableDockerBuilderBuildContext(input.DockerBuilderBuildContext).
		SetNillableDefinitionVersion(input.CustomDefinitionVersion).
		SetNillableS3BackupSourceID(input.S3BackupSourceID).
		SetNillableS3BackupBucket(input.S3BackupBucket).
		SetNillableBackupSchedule(input.BackupSchedule).
		SetNillableBackupRetentionCount(input.BackupRetentionCount)

	if input.Resources != nil {
		c.SetResources(input.Resources)
	}

	if input.InitContainers != nil {
		c.SetInitContainers(input.InitContainers)
	}

	if input.OverwriteVolumes != nil {
		c.SetVolumes(input.OverwriteVolumes)
	}

	if input.ProtectedVariables != nil {
		c.SetProtectedVariables(*input.ProtectedVariables)
	}

	if len(input.OverwriteVariableMounts) > 0 {
		c.SetVariableMounts(input.OverwriteVariableMounts)
	}

	if input.HealthCheck != nil {
		c.SetHealthCheck(input.HealthCheck)
	}

	if input.SecurityContext != nil {
		c.SetSecurityContext(input.SecurityContext)
	}

	if input.DatabaseConfig != nil {
		c.SetDatabaseConfig(input.DatabaseConfig)
	}

	if len(input.OverwritePorts) > 0 {
		c.SetPorts(input.OverwritePorts)
	}

	if len(input.OverwriteHosts) > 0 {
		c.SetHosts(input.OverwriteHosts)
	}

	return c.Save(ctx)
}

// Update the service
func (self *ServiceRepository) Update(
	ctx context.Context,
	tx repository.TxInterface,
	serviceID uuid.UUID,
	name *string,
	description *string,
) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.Service.Update().
		Where(service.IDEQ(serviceID)).
		SetNillableName(name).
		SetNillableDescription(description).
		Exec(ctx)
}

// Update service config
func (self *ServiceRepository) UpdateConfig(
	ctx context.Context,
	tx repository.TxInterface,
	input *MutateConfigInput,
) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	// Fetch existing service config to merge resources and other fields
	existingConfig, err := db.ServiceConfig.Query().
		Where(serviceconfig.ServiceID(input.ServiceID)).
		Only(ctx)
	if err != nil {
		return err
	}

	upd := db.ServiceConfig.UpdateOneID(existingConfig.ID).
		SetNillableBuilder(input.Builder).
		SetNillableReplicas(input.Replicas).
		SetNillableAutoDeploy(input.AutoDeploy).
		SetNillableIsPublic(input.Public).
		SetNillableImage(input.Image).
		SetNillableDefinitionVersion(input.CustomDefinitionVersion).
		SetNillableBackupSchedule(input.BackupSchedule).
		SetNillableBackupRetentionCount(input.BackupRetentionCount)

	if input.Resources != nil {
		// If all values are < 1, we clear the resources
		if input.Resources.CPULimitsMillicores < 1 &&
			input.Resources.CPURequestsMillicores < 1 &&
			input.Resources.MemoryRequestsMegabytes < 1 &&
			input.Resources.MemoryLimitsMegabytes < 1 {
			upd.ClearResources()
		} else {
			// Merge with existing resources
			if existingConfig != nil && existingConfig.Resources != nil {
				if input.Resources.CPULimitsMillicores < 1 {
					input.Resources.CPULimitsMillicores = existingConfig.Resources.CPULimitsMillicores
				}
				if input.Resources.CPURequestsMillicores < 1 {
					input.Resources.CPURequestsMillicores = existingConfig.Resources.CPURequestsMillicores
				}
				if input.Resources.MemoryRequestsMegabytes < 1 {
					input.Resources.MemoryRequestsMegabytes = existingConfig.Resources.MemoryRequestsMegabytes
				}
				if input.Resources.MemoryLimitsMegabytes < 1 {
					input.Resources.MemoryLimitsMegabytes = existingConfig.Resources.MemoryLimitsMegabytes
				}
			}

			upd.SetResources(input.Resources)
		}
	}

	if input.InitContainers != nil {
		if len(input.InitContainers) > 0 {
			upd.SetInitContainers(input.InitContainers)
		} else {
			upd.ClearInitContainers()
		}
	}

	if input.ProtectedVariables != nil {
		upd.SetProtectedVariables(*input.ProtectedVariables)
	}

	if input.HealthCheck != nil {
		if input.HealthCheck.Type == nil || *input.HealthCheck.Type == schema.HealthCheckTypeNone {
			upd.ClearHealthCheck()
		} else {
			upd.SetHealthCheck(input.HealthCheck)
		}
	}

	if input.SecurityContext != nil {
		upd.SetSecurityContext(input.SecurityContext)
	}

	if input.RailpackBuilderInstallCommand != nil {
		if *input.RailpackBuilderInstallCommand == "" {
			upd.ClearRailpackBuilderInstallCommand()
		} else {
			upd.SetRailpackBuilderInstallCommand(*input.RailpackBuilderInstallCommand)
		}
	}

	if input.RailpackBuilderBuildCommand != nil {
		if *input.RailpackBuilderBuildCommand == "" {
			upd.ClearRailpackBuilderBuildCommand()
		} else {
			upd.SetRailpackBuilderBuildCommand(*input.RailpackBuilderBuildCommand)
		}
	}

	if input.RunCommand != nil {
		if *input.RunCommand == "" {
			upd.ClearRunCommand()
		} else {
			upd.SetRunCommand(*input.RunCommand)
		}
	}

	if input.GitBranch != nil {
		if *input.GitBranch == "" {
			upd.ClearGitBranch()
		} else {
			upd.SetGitBranch(*input.GitBranch)
		}
	}
	if input.GitTag != nil {
		if *input.GitTag == "" {
			upd.ClearGitTag()
		} else {
			upd.SetGitTag(*input.GitTag)
		}
	}

	if input.S3BackupBucket != nil {
		if *input.S3BackupBucket == "" {
			upd.ClearS3BackupBucket()
		} else {
			upd.SetS3BackupBucket(*input.S3BackupBucket)
		}
	}

	if input.S3BackupSourceID != nil {
		if *input.S3BackupSourceID == uuid.Nil {
			upd.ClearS3BackupSourceID()
		} else {
			upd.SetS3BackupSourceID(*input.S3BackupSourceID)
		}
	}

	if input.DatabaseConfig != nil {
		upd.SetDatabaseConfig(input.DatabaseConfig)

		if input.DatabaseConfig.Version != "" {
			// Set on service
			_, err := db.Service.UpdateOneID(input.ServiceID).
				SetDatabaseVersion(input.DatabaseConfig.Version).
				Save(ctx)
			if err != nil {
				return err
			}
		}
	}

	if input.DockerBuilderDockerfilePath != nil {
		if *input.DockerBuilderDockerfilePath == "" {
			upd.ClearDockerBuilderDockerfilePath()
		} else {
			upd.SetDockerBuilderDockerfilePath(*input.DockerBuilderDockerfilePath)
		}
	}

	if input.DockerBuilderBuildContext != nil {
		if *input.DockerBuilderBuildContext == "" {
			upd.ClearDockerBuilderBuildContext()
		} else {
			upd.SetDockerBuilderBuildContext(*input.DockerBuilderBuildContext)
		}
	}

	// * A bunch of jsonb merging logic for volumes, ports, hosts, and variable mounts
	if len(input.OverwriteVariableMounts) > 0 {
		upd.SetVariableMounts(input.OverwriteVariableMounts)
	} else if len(input.AddVariableMounts) > 0 || len(input.RemoveVariableMounts) > 0 {
		variableMounts := existingConfig.VariableMounts
		// Create a map of variable mounts to remove for efficient lookup
		toRemove := make(map[string]bool)
		// Add all AddVariableMounts and RemoveVariableMounts to the removal map to prevent duplicates
		for _, addVariableMount := range input.AddVariableMounts {
			toRemove[addVariableMount.Name] = true
		}
		for _, removeVariableMount := range input.RemoveVariableMounts {
			toRemove[removeVariableMount.Name] = true
		}
		// Filter existing variable mounts, removing any that match AddVariableMounts or RemoveVariableMounts
		var filteredVariableMounts []*schema.VariableMount
		for _, variableMount := range variableMounts {
			if !toRemove[variableMount.Name] {
				filteredVariableMounts = append(filteredVariableMounts, variableMount)
			}
		}
		// Append all AddVariableMounts to the filtered list
		filteredVariableMounts = append(filteredVariableMounts, input.AddVariableMounts...)
		if len(filteredVariableMounts) == 0 {
			upd.ClearVariableMounts()
		} else {
			upd.SetVariableMounts(filteredVariableMounts)
		}
	}
	if len(input.OverwriteVolumes) > 0 {
		upd.SetVolumes(input.OverwriteVolumes)
	} else if len(input.AddVolumes) > 0 || len(input.RemoveVolumes) > 0 {
		volumes := existingConfig.Volumes

		// Create a map of volumes to remove for efficient lookup
		toRemove := make(map[string]bool)
		// Add all AddVolumes and RemoveVolumes to the removal map to prevent duplicates
		for _, addVolume := range input.AddVolumes {
			toRemove[addVolume.ID] = true
		}
		for _, removeVolume := range input.RemoveVolumes {
			toRemove[removeVolume.ID] = true
		}
		// Filter existing volumes, removing any that match AddVolumes or RemoveVolumes
		var filteredVolumes []schema.ServiceVolume
		for _, volume := range volumes {
			if !toRemove[volume.ID] {
				filteredVolumes = append(filteredVolumes, volume)
			}
		}
		// Append all AddVolumes to the filtered list
		filteredVolumes = append(filteredVolumes, input.AddVolumes...)
		if len(filteredVolumes) == 0 {
			upd.ClearVolumes()
		} else {
			upd.SetVolumes(filteredVolumes)
		}
	}

	if len(input.OverwritePorts) > 0 {
		upd.SetPorts(input.OverwritePorts)
	} else if len(input.AddPorts) > 0 || len(input.RemovePorts) > 0 {
		ports := existingConfig.Ports

		// Create a map of ports to remove for efficient lookup
		toRemove := make(map[int32]bool)
		// Add all AddPorts and RemovePorts to the removal map to prevent duplicates
		for _, addPort := range input.AddPorts {
			toRemove[addPort.Port] = true
		}
		for _, removePort := range input.RemovePorts {
			toRemove[removePort.Port] = true
		}
		// Filter existing ports, removing any that match AddPorts or RemovePorts
		var filteredPorts []schema.PortSpec
		for _, port := range ports {
			if !toRemove[port.Port] {
				filteredPorts = append(filteredPorts, port)
			}
		}
		// Append all AddPorts to the filtered list
		filteredPorts = append(filteredPorts, input.AddPorts...)
		if len(filteredPorts) == 0 {
			upd.ClearPorts()
		} else {
			upd.SetPorts(filteredPorts)
		}
	}

	if len(input.OverwriteHosts) > 0 {
		upd.SetHosts(input.OverwriteHosts)
	} else if len(input.UpsertHosts) > 0 || len(input.RemoveHosts) > 0 {
		hosts := existingConfig.Hosts

		// Create a map of hosts to remove for efficient lookup
		toRemove := make(map[string]bool)

		// Add all UpsertHosts and RemoveHosts to the removal map to prevent duplicates
		for _, upsertHost := range input.UpsertHosts {
			if upsertHost.PrevHost != nil {
				toRemove[*upsertHost.PrevHost] = true
				continue
			}
			toRemove[upsertHost.Host] = true
		}
		for _, removeHost := range input.RemoveHosts {
			toRemove[removeHost.Host] = true
		}

		// Filter existing hosts, removing any that match AddHosts or RemoveHosts
		var filteredHosts []schema.HostSpec
		for _, host := range hosts {
			if !toRemove[host.Host] {
				filteredHosts = append(filteredHosts, host)
			}
		}

		// Append all AddHosts to the filtered list
		filteredHosts = append(filteredHosts, input.UpsertHosts...)

		if len(filteredHosts) == 0 {
			upd.ClearHosts()
		} else {
			upd.SetHosts(filteredHosts)
		}
	}

	updatedConfig, err := upd.Save(ctx)
	if err != nil {
		return err
	}

	// Synchronize target host ports
	if len(updatedConfig.Hosts) > 0 {
		needsUpdate := false
		validPorts := make(map[int32]bool)
		for _, port := range updatedConfig.Ports {
			if port.Protocol == nil || *port.Protocol == schema.ProtocolTCP {
				validPorts[port.Port] = true
			}
		}

		for i, host := range updatedConfig.Hosts {
			if host.TargetPort != nil {
				// If the target port is not valid, set it to nil
				if _, exists := validPorts[*host.TargetPort]; !exists {
					updatedConfig.Hosts[i].TargetPort = nil
					needsUpdate = true
				}
			}
		}
		if needsUpdate {
			_, err = db.ServiceConfig.UpdateOneID(updatedConfig.ID).
				SetHosts(updatedConfig.Hosts).
				Save(ctx)
			if err != nil {
				return fmt.Errorf("failed to update service config hosts after port synchronization: %w", err)
			}
		}
	}

	return nil
}

func (self *ServiceRepository) Delete(ctx context.Context, tx repository.TxInterface, serviceID uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Service.DeleteOneID(serviceID).Exec(ctx)
}

func (self *ServiceRepository) SetCurrentDeployment(ctx context.Context, tx repository.TxInterface, serviceID uuid.UUID, deploymentID uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.Service.UpdateOneID(serviceID).SetCurrentDeploymentID(deploymentID).Exec(ctx)
}

func (self *ServiceRepository) UpdateVariableMounts(ctx context.Context, tx repository.TxInterface, serviceID uuid.UUID, variableMounts []*schema.VariableMount) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.ServiceConfig.Update().
		Where(serviceconfig.ServiceID(serviceID)).
		SetVariableMounts(variableMounts).
		Exec(ctx)
}

func (self *ServiceRepository) UpdateDatabaseStorageSize(
	ctx context.Context,
	tx repository.TxInterface,
	serviceID uuid.UUID,
	newSize string,
) (*schema.DatabaseConfig, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	newSize = utils.EnsureSuffix(newSize, "Gi")

	svcConfig, err := db.Service.Query().
		Where(service.IDEQ(serviceID)).
		QueryServiceConfig().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	if svcConfig.DatabaseConfig != nil {
		svcConfig.DatabaseConfig.StorageSize = newSize
	} else {
		svcConfig.DatabaseConfig = &schema.DatabaseConfig{
			StorageSize: newSize,
		}
	}

	updatedCfg, err := db.ServiceConfig.UpdateOneID(svcConfig.ID).
		SetDatabaseConfig(svcConfig.DatabaseConfig).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return updatedCfg.DatabaseConfig, nil
}
