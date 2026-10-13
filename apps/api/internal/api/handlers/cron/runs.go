package cron_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListCronRunsInput struct {
	server.BaseAuthInput
	models.CronRunServiceInput
}

type ListCronRunsResponse struct {
	Body struct {
		Data []*models.CronRunResponse `json:"data" nullable:"false"`
	}
}

// ListCronRuns handles GET /cron/runs
func (self *HandlerGroup) ListCronRuns(ctx context.Context, input *ListCronRunsInput) (*ListCronRunsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	runs, err := self.srv.ServiceService.ListCronRuns(ctx, user.ID, &input.CronRunServiceInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListCronRunsResponse{}
	resp.Body.Data = runs
	return resp, nil
}

type StartCronRunInput struct {
	server.BaseAuthInput
	Body struct {
		TeamID        uuid.UUID `json:"team_id" required:"true" format:"uuid"`
		ProjectID     uuid.UUID `json:"project_id" required:"true" format:"uuid"`
		EnvironmentID uuid.UUID `json:"environment_id" required:"true" format:"uuid"`
		ServiceID     uuid.UUID `json:"service_id" required:"true" format:"uuid"`
	}
}

type StartCronRunResponse struct {
	Body struct {
		Data *models.CronRunResponse `json:"data"`
	}
}

// StartCronRun handles POST /cron/run
func (self *HandlerGroup) StartCronRun(ctx context.Context, input *StartCronRunInput) (*StartCronRunResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	run, err := self.srv.ServiceService.StartCronRun(ctx, user.ID, &models.CronRunServiceInput{
		TeamID:        input.Body.TeamID,
		ProjectID:     input.Body.ProjectID,
		EnvironmentID: input.Body.EnvironmentID,
		ServiceID:     input.Body.ServiceID,
	})
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &StartCronRunResponse{}
	resp.Body.Data = run
	return resp, nil
}
