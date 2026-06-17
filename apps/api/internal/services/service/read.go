package service_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Get all services in an environment
func (self *ServiceService) GetServicesInEnvironment(ctx context.Context, requesterUserID uuid.UUID, teamID, projectID, environmentID uuid.UUID) ([]*models.ServiceResponse, error) {
	// Step 1: Get accessible service predicates for the user, scoped to the environmentID.
	servicePreds, err := self.repo.Permissions().GetAccessibleServicePredicates(ctx, requesterUserID, schema.ActionViewer, &environmentID)
	if err != nil {
		return nil, fmt.Errorf("error getting accessible service predicates: %w", err)
	}

	// Step 2: Verify parent inputs (team, project, environment) for integrity and clear error messages.
	// The VerifyInputs method already checks existence and relationships.
	_, project, err := self.VerifyInputs(ctx, teamID, projectID, environmentID)
	if err != nil {
		log.Errorf("Error verifying inputs for environment %s: %v", environmentID, err)
		// VerifyInputs already returns specific errors like NotFound or InvalidInput
		return nil, err
	}

	// Step 3: Get services in environment, applying the permission predicate.
	// The GetByEnvironmentID repo method already filters by environmentID.
	// Pass true for withLatestDeployment as per original logic.
	services, err := self.repo.Service().GetByEnvironmentID(ctx, environmentID, servicePreds, true)
	if err != nil {
		log.Errorf("Error fetching services for environment %s: %v", environmentID, err)
		return nil, fmt.Errorf("error fetching services for environment %s: %w", environmentID, err)
	}

	// Get volume map
	volumeMap, err := self.getVolumesForServices(ctx, project.Edges.Team.Namespace, project.Edges.Team.ID, services)
	if err != nil {
		log.Errorf("Error getting volumes for services in environment %s: %v", environmentID, err)
		return nil, err
	}

	// Convert to response
	resp := models.TransformServiceEntities(services)

	// Attach volumes
	if len(volumeMap) > 0 {
		for i := range resp {
			volumes := volumeMap[resp[i].ID]
			if volumes != nil {
				resp[i].Config.Volumes = volumes
			}
		}
	}

	// Attach instance data efficiently for all services in the environment
	if len(services) > 0 {
		instanceDataMap, err := self.deploymentService.AttachInstanceDataToServices(ctx, services, project.Edges.Team.Namespace)
		if err != nil {
			log.Error("Error attaching instance data to services", "err", err, "environment_id", environmentID)
			return nil, err
		}
		self.deploymentService.AttachInstanceDataToServiceResponses(resp, instanceDataMap)
	}

	return resp, nil
}

// Get a service by ID
func (self *ServiceService) GetServiceByID(ctx context.Context, requesterUserID uuid.UUID, teamID, projectID, environmentID, serviceID uuid.UUID) (*models.ServiceResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to admin service
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   serviceID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Verify inputs
	_, project, err := self.VerifyInputs(ctx, teamID, projectID, environmentID)
	if err != nil {
		return nil, err
	}

	// Get services in environment
	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
		}
		return nil, err
	}

	// Get volume map
	volumeMap, err := self.getVolumesForServices(ctx, project.Edges.Team.Namespace, project.Edges.Team.ID, []*ent.Service{
		service,
	})
	if err != nil {
		return nil, err
	}

	// Convert to response
	resp := models.TransformServiceEntity(service)

	// Attach volumes
	volumes := volumeMap[service.ID]
	if volumes != nil {
		resp.Config.Volumes = volumes
	}

	// Attach instance data for this single service
	if service.Edges.CurrentDeployment != nil {
		instanceDataMap, err := self.deploymentService.AttachInstanceDataToServices(ctx, []*ent.Service{service}, project.Edges.Team.Namespace)
		if err != nil {
			log.Error("Error attaching instance data to service", "err", err, "service_id", serviceID)
			return nil, err
		}
		self.deploymentService.AttachInstanceDataToServiceResponse(resp, instanceDataMap)
	}

	return resp, nil
}
