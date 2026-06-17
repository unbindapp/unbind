package project_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"

	// entProject "github.com/unbindapp/unbind-api/ent/project" // No longer needed directly here
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *ProjectService) GetProjectsInTeam(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID, sortBy models.SortByField, sortOrder models.SortOrder) ([]*models.ProjectResponse, error) {
	// Step 1: Get accessible project predicates for the user with ActionViewer.
	projectPreds, err := self.repo.Permissions().GetAccessibleProjectPredicates(ctx, requesterUserID, schema.ActionViewer)
	if err != nil {
		return nil, fmt.Errorf("error getting accessible project predicates: %w", err)
	}

	// Step 2: Check if the team itself exists. This is a necessary validation.
	_, err = self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, fmt.Errorf("error fetching team: %w", err)
	}

	// Step 3: Call the repository method to get projects, passing the auth predicate and sorting.
	projects, err := self.repo.Project().GetByTeam(ctx, teamID, projectPreds, sortBy, sortOrder)
	if err != nil {
		return nil, fmt.Errorf("error fetching projects by team: %w", err)
	}

	// Transform response
	resp := models.TransformProjectEntitities(projects)

	// Summarizes services
	for _, project := range resp {
		environmentIDs := make([]uuid.UUID, len(project.Environments))
		for i, environment := range project.Environments {
			environmentIDs[i] = environment.ID
		}
		counts, providerSummaries, err := self.repo.Service().SummarizeServices(ctx, environmentIDs)
		if err != nil {
			return nil, err
		}
		project.AttachServiceSummary(counts, providerSummaries)
	}

	return resp, nil
}

// Get a single project by ID
func (self *ProjectService) GetProjectByID(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID, projectID uuid.UUID) (*models.ProjectResponse, error) {
	// For fetching a single resource, the existing Check method is generally fine.
	// If the user doesn't have ActionViewer on that specific projectID (or its hierarchy),
	// they shouldn't get it. The new predicate system is primarily for *filtering lists*.
	// So, GetProjectByID might not need to change for now.
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to read project
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   projectID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Check if the team exists
	_, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err // Return the original error for better context
	}

	// Get projects
	projectEntity, err := self.repo.Project().GetByID(ctx, projectID) // Renamed to avoid conflict with project package import
	if err != nil {
		// Handle potential not found from GetByID as well
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
		}
		return nil, err
	}

	// Ensure the project actually belongs to the team specified in the path/request.
	// This check is important even if permissions allow access to the project, to ensure URL consistency.
	if projectEntity.TeamID != teamID {
		// Using ErrUnauthorized because the project is not accessible via the provided team_id path parameter.
		return nil, errdefs.ErrUnauthorized
	}

	// Convert to response
	resp := models.TransformProjectEntity(projectEntity)

	// Summarizes services
	environmentIDs := make([]uuid.UUID, len(resp.Environments))
	for i, environment := range resp.Environments {
		environmentIDs[i] = environment.ID
	}
	counts, providerSummaries, err := self.repo.Service().SummarizeServices(ctx, environmentIDs)
	if err != nil {
		return nil, err
	}
	resp.AttachServiceSummary(counts, providerSummaries)

	return resp, nil
}
