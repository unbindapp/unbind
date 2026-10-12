package team_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	project_service "github.com/unbindapp/unbind-api/internal/services/project"
)

// DeleteTeam tears down every project and bucket through their own services, then
// removes the team and its namespace. Role groups go with the team row, and the
// namespace takes the Kubernetes roles with it.
func (self *TeamService) DeleteTeam(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return err
	}

	for _, project := range team.Edges.Projects {
		if err := self.projectService.DeleteProject(ctx, requesterUserID, &project_service.DeleteProjectInput{
			TeamID:    teamID,
			ProjectID: project.ID,
		}); err != nil {
			return err
		}
	}

	buckets, err := self.repo.S3Bucket().GetByTeam(ctx, teamID)
	if err != nil {
		return err
	}
	for _, bucket := range buckets {
		if err := self.storageService.DeleteS3BucketByID(ctx, requesterUserID, teamID, bucket.ID); err != nil {
			return err
		}
	}

	client := self.k8s.GetInternalClient()
	return self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if err := self.repo.Team().Delete(ctx, tx, teamID); err != nil {
			return err
		}
		return self.k8s.DeleteNamespace(ctx, team.Namespace, client)
	})
}
