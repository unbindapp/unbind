package logs_service

import (
	"context"
	"fmt"
	"time"

	"github.com/danielgtaylor/huma/v2/sse"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *LogsService) StreamLogs(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.LogStreamInput, send sse.Sender) error {
	team, project, environment, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return err
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
				return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Deployment not found")
			}
			return err
		}

		// Validate that the deployment belongs to the level requested
		if err := self.validateDeploymentInput(ctx, deployment, service, environment, project, team); err != nil {
			return err
		}

		if input.Type == models.LogTypeBuild {
			label = loki.LokiLabelBuild
		} else {
			label = loki.LokiLabelDeployment
		}
		labelValue = deployment.ID.String()
	}

	// Parse 'since' duration
	var since time.Duration
	if input.Since != "" {
		since, err = time.ParseDuration(input.Since)
		if err != nil {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "invalid since duration")
		}
	}

	// Create a channel for log events
	eventChan := make(chan loki.LogEvents, 100)

	// Create a context with cancellation
	streamCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Create loki options
	lokiLogOptions := loki.LokiLogStreamOptions{
		Label:      label,
		LabelValue: labelValue,
		Limit:      int(input.Limit),
		RawFilter:  input.Filters,
		Since:      since,
		Start:      input.Start,
	}

	// Stream from Loki
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Errorf("Recovered from panic in log streaming goroutine: %v", r)
			}
		}()

		err := self.lokiQuerier.StreamLokiPodLogs(streamCtx, lokiLogOptions, eventChan)
		if err != nil {
			// Wrap the send in a select with context check to avoid sending on canceled contexts
			select {
			case <-streamCtx.Done():
				return
			default:
				_ = send.Data(loki.LogEvents{
					MessageType:  loki.LogEventsMessageTypeError,
					ErrorMessage: fmt.Sprintf("Error streaming logs: %v", err),
				})
			}
		}
	}()
	// }

	// Send events to the client
	for {
		select {
		case event := <-eventChan:
			_ = send.Data(event)
		case <-ctx.Done():
			return nil
		}
	}
}
