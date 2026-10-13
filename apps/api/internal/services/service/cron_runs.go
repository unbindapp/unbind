package service_service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
)

func (self *ServiceService) ListCronRuns(ctx context.Context, requesterUserID uuid.UUID, input *models.CronRunServiceInput) ([]*models.CronRunResponse, error) {
	service, namespace, err := self.scheduledService(ctx, requesterUserID, schema.ActionViewer, input)
	if err != nil {
		return nil, err
	}
	return self.k8s.ListCronRuns(ctx, namespace, service.ID, self.k8s.GetInternalClient())
}

func (self *ServiceService) StartCronRun(ctx context.Context, requesterUserID uuid.UUID, input *models.CronRunServiceInput) (*models.CronRunResponse, error) {
	service, namespace, err := self.scheduledService(ctx, requesterUserID, schema.ActionEditor, input)
	if err != nil {
		return nil, err
	}

	run, err := self.k8s.StartCronRun(ctx, namespace, service.KubernetesName, self.k8s.GetInternalClient())
	switch {
	case kerrors.IsNotFound(err):
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "The schedule is not deployed yet, deploy the service first")
	case errors.Is(err, k8s.ErrCronRunInProgress):
		return nil, errdefs.NewCustomError(errdefs.ErrTypeConflict, "A run is already in progress")
	case err != nil:
		return nil, err
	}
	return run, nil
}

// scheduledService resolves a service that runs on a cron schedule, in its team's namespace
func (self *ServiceService) scheduledService(ctx context.Context, requesterUserID uuid.UUID, action schema.PermittedAction, input *models.CronRunServiceInput) (*ent.Service, string, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       action,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.ServiceID,
		},
	}
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, "", err
	}

	env, project, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, "", err
	}

	service, err := self.repo.Service().GetByID(ctx, input.ServiceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
		}
		return nil, "", err
	}
	if env.ID != service.EnvironmentID {
		return nil, "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
	}
	if !isScheduled(service.Edges.ServiceConfig) {
		return nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "The service has no cron schedule")
	}

	return service, project.Edges.Team.Namespace, nil
}

func isScheduled(config *ent.ServiceConfig) bool {
	return config != nil && config.CronSchedule != nil && *config.CronSchedule != ""
}
