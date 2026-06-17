package environment_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Get a single environment by ID
func (self *EnvironmentService) GetEnvironmentByID(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID, projectID uuid.UUID, environmentID uuid.UUID) (*models.EnvironmentResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   environmentID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Verify inputs
	_, environment, err := self.VerifyInputs(ctx, teamID, projectID, environmentID)
	if err != nil {
		return nil, err
	}

	// Convert to response
	resp := models.TransformEnvironmentEntity(environment)

	// Summarizes services
	counts, providerSummaries, err := self.repo.Service().SummarizeServices(ctx, []uuid.UUID{environmentID})
	if err != nil {
		return nil, err
	}
	resp.ServiceCount, _ = counts[environmentID]
	resp.ServiceIcons, _ = providerSummaries[environmentID]

	return resp, nil
}

// Get all environments in a project
func (self *EnvironmentService) GetEnvironmentsByProjectID(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID, projectID uuid.UUID) ([]*models.EnvironmentResponse, error) {
	// Step 1: Get accessible environment predicates for the user, scoped to the projectID.
	envPreds, err := self.repo.Permissions().GetAccessibleEnvironmentPredicates(ctx, requesterUserID, schema.ActionViewer, &projectID)
	if err != nil {
		return nil, fmt.Errorf("error getting accessible environment predicates: %w", err)
	}

	// Step 2: Verify parent project and team consistency (important for URL integrity and clear errors).
	project, err := self.repo.Project().GetByID(ctx, projectID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
		}
		return nil, fmt.Errorf("error fetching project %s: %w", projectID, err)
	}
	if project.TeamID != teamID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
	}

	// Step 3: Query environments using the repository method, passing the auth predicate.
	// The GetForProject method already filters by projectID.
	envs, err := self.repo.Environment().GetForProject(ctx, nil, projectID, envPreds)
	if err != nil {
		return nil, fmt.Errorf("error fetching environments for project %s: %w", projectID, err)
	}

	// Convert to response
	return models.TransformEnvironmentEntitities(envs), nil
}
