package deployment_repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/deployment"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/project"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/team"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

func (self *DeploymentRepository) GetByID(ctx context.Context, deploymentID uuid.UUID) (*ent.Deployment, error) {
	return self.base.DB.Deployment.Query().
		Where(deployment.IDEQ(deploymentID)).
		Only(ctx)
}

func (self *DeploymentRepository) ExistsInEnvironment(ctx context.Context, deploymentID uuid.UUID, environmentID uuid.UUID) (bool, error) {
	count, err := self.base.DB.Deployment.Query().
		Where(deployment.IDEQ(deploymentID)).
		QueryService().
		QueryEnvironment().Where(
		environment.ID(environmentID),
	).
		Count(ctx)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (self *DeploymentRepository) ExistsInProject(ctx context.Context, deploymentID uuid.UUID, projectID uuid.UUID) (bool, error) {
	count, err := self.base.DB.Deployment.Query().
		Where(deployment.IDEQ(deploymentID)).
		QueryService().
		QueryEnvironment().
		QueryProject().Where(
		project.IDEQ(projectID),
	).
		Count(ctx)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (self *DeploymentRepository) ExistsInTeam(ctx context.Context, deploymentID uuid.UUID, teamID uuid.UUID) (bool, error) {
	count, err := self.base.DB.Deployment.Query().
		Where(deployment.IDEQ(deploymentID)).
		QueryService().
		QueryEnvironment().
		QueryProject().
		QueryTeam().Where(
		team.ID(teamID),
	).
		Count(ctx)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (self *DeploymentRepository) GetLastSuccessfulDeployment(ctx context.Context, serviceID uuid.UUID) (*ent.Deployment, error) {
	return self.base.DB.Deployment.Query().
		Where(deployment.ServiceIDEQ(serviceID)).
		Where(deployment.StatusEQ(schema.DeploymentStatusBuildSucceeded)).
		Order(ent.Desc(deployment.FieldCreatedAt)).
		First(ctx)
}

func (self *DeploymentRepository) GetJobsByStatus(ctx context.Context, status schema.DeploymentStatus) ([]*ent.Deployment, error) {
	return self.base.DB.Deployment.Query().
		Where(deployment.StatusEQ(status)).
		All(ctx)
}

func (self *DeploymentRepository) GetByServiceIDPaginated(ctx context.Context, serviceID uuid.UUID, perPage int, cursor *time.Time, statusFilter []schema.DeploymentStatus) (jobs []*ent.Deployment, nextCursor *time.Time, err error) {
	query := self.base.DB.Deployment.Query().
		Where(deployment.ServiceIDEQ(serviceID))

	if cursor != nil {
		query = query.Where(deployment.CreatedAtLT(*cursor))
	}

	if len(statusFilter) > 0 {
		query = query.Where(deployment.StatusIn(statusFilter...))
	}

	all, err := query.
		Order(ent.Desc(deployment.FieldCreatedAt)).
		Limit(perPage + 1).
		All(ctx)
	if err != nil {
		return nil, nil, err
	}

	// If we have more than the perPage limit, we have a next page, get its cursot and truncate the results
	if len(all) > perPage {
		nextCursor = utils.ToPtr(all[perPage].CreatedAt)
		all = all[:perPage]
	}

	return all, nextCursor, nil
}
