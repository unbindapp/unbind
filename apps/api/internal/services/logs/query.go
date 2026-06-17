package logs_service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *LogsService) QueryLogs(ctx context.Context, requesterUserID uuid.UUID, input *models.LogQueryInput) ([]loki.LogEvent, error) {
	team, project, environment, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	// Build labels to select
	var label loki.LokiLabelName
	var labelValue string
	switch input.Type {
	case models.LogTypeTeam:
		label = loki.LokiLabelTeam
		labelValue = team.ID.String()
	case models.LogTypeProject:
		label = loki.LokiLabelProject
		labelValue = project.ID.String()
	case models.LogTypeEnvironment:
		label = loki.LokiLabelEnvironment
		labelValue = environment.ID.String()
	case models.LogTypeService:
		label = loki.LokiLabelService
		labelValue = service.ID.String()
	case models.LogTypeDeployment, models.LogTypeBuild:
		// get deployment
		deployment, err := self.repo.Deployment().GetByID(ctx, input.DeploymentID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Deployment not found")
			}
			return nil, err
		}

		// Validate that the deployment belongs to the level requested
		if err := self.validateDeploymentInput(ctx, deployment, service, environment, project, team); err != nil {
			return nil, err
		}

		if input.Type == models.LogTypeBuild {
			label = loki.LokiLabelBuild
		} else {
			label = loki.LokiLabelDeployment
		}
		labelValue = deployment.ID.String()
	}

	// Parse 'since' duration
	var since *time.Duration
	if input.Since != "" {
		sinceDuration, err := time.ParseDuration(input.Since)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "invalid since duration")
		}
		since = &sinceDuration
	}

	// Create loki options
	var start *time.Time
	var end *time.Time
	var limit *int
	var direction *loki.LokiDirection
	if !input.Start.IsZero() {
		start = &input.Start
	}
	if !input.End.IsZero() {
		end = &input.End
	}
	if input.Limit != 0 {
		limit = &input.Limit
	}
	if input.Direction != "" {
		direction = &input.Direction
	}
	lokiLogOptions := loki.LokiLogHTTPOptions{
		Label:      label,
		LabelValue: labelValue,
		RawFilter:  input.Filters,
		Since:      since,
		Start:      start,
		End:        end,
		Limit:      limit,
		Direction:  direction,
	}

	// Query logs
	return self.lokiQuerier.QueryLokiLogs(ctx, lokiLogOptions)
}
