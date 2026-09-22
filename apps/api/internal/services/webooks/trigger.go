package webhooks_service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

type WebhookData struct {
	Title       string             `json:"title"`
	Url         string             `json:"url"`
	Description string             `json:"description"`
	Fields      []WebhookDataField `json:"fields"`
}

type WebhookDataField struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type WebhookLevel string

const (
	WebhookLevelError               WebhookLevel = "error"
	WebhookLevelWarning             WebhookLevel = "warning"
	WebhookLevelInfo                WebhookLevel = "info"
	WebhookLevelDeploymentQueued    WebhookLevel = "queued"
	WebhookLevelDeploymentBuilding  WebhookLevel = "building"
	WebhookLevelDeploymentSucceeded WebhookLevel = "succeeded"
	WebhookLevelDeploymentFailed    WebhookLevel = "failed"
)

func (self *WebhookLevel) DecimalColor() *string {
	switch *self {
	case WebhookLevelDeploymentQueued:
		return new("13738823")
	case WebhookLevelDeploymentBuilding:
		return new("6724095")
	case WebhookLevelDeploymentFailed:
		return new("15692145")
	case WebhookLevelDeploymentSucceeded:
		return new("7983737")
	case WebhookLevelError:
		return new("15692145")
	case WebhookLevelWarning:
		return new("13738823")
	default:
		return new("7983737") // Success
	}
}

// Helper method for WebhookLevel to return Slack color
func (level WebhookLevel) HexColor() *string {
	switch level {
	case WebhookLevelError:
		return new("#8B0000")
	case WebhookLevelWarning:
		return new("#802000")
	default:
		return new("#0C3B0C")
	}
}

// Emoji indicator for the ones not supporting style (telegram)
func (level WebhookLevel) Emoji() string {
	var levelBar string
	switch level {
	case WebhookLevelError:
		levelBar = "🔴"
	case WebhookLevelWarning:
		levelBar = "🟠"
	default:
		levelBar = "🟢"
	}
	return levelBar
}

func (self *WebhooksService) TriggerWebhooks(ctx context.Context, level WebhookLevel, event schema.WebhookEvent, message WebhookData, teamID uuid.UUID, projectID uuid.UUID) error {
	webhooks, err := self.webhooksForEvent(ctx, event, teamID, projectID)
	if err != nil {
		return err
	}

	var errs []error
	for _, webhook := range webhooks {
		if err := self.send(level, event, message, webhook.URL); err != nil {
			log.Errorf("Failed to send webhook %s to %s: %v", event, webhook.URL, err)
			errs = append(errs, err)
		}
	}

	return errors.Join(errs...)
}

func (self *WebhooksService) webhooksForEvent(ctx context.Context, event schema.WebhookEvent, teamID uuid.UUID, projectID uuid.UUID) ([]*ent.Webhook, error) {
	if event.WebhookType() == schema.WebhookTypeTeam {
		return self.repo.Webhooks().GetByTeamForEvent(ctx, teamID, event)
	}
	return self.repo.Webhooks().GetByProjectForEvent(ctx, projectID, event)
}

func (self *WebhooksService) send(level WebhookLevel, event schema.WebhookEvent, message WebhookData, url string) error {
	target, err := self.DetectTargetFromURL(url)
	if err != nil {
		return err
	}

	switch target {
	case schema.WebhookTargetDiscord:
		return self.sendDiscordWebhook(level, event, message, url)
	case schema.WebhookTargetSlack:
		return self.sendSlackWebhook(level, event, message, url)
	case schema.WebhookTargetTelegram:
		return self.sendTelegramWebhook(level, event, message, url)
	default:
		return self.sendDefaultWebhook(level, event, message, url)
	}
}

func (self *WebhooksService) sendDefaultWebhook(level WebhookLevel, event schema.WebhookEvent, message WebhookData, url string) error {
	msg := DefaultPayload{
		Level: level,
		Event: event,
		Data:  message,
	}

	payload := new(bytes.Buffer)
	if err := json.NewEncoder(payload).Encode(msg); err != nil {
		return fmt.Errorf("failed to encode webhook payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, payload)
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := self.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}

	bodyBytes, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return fmt.Errorf("failed to send webhook: %s, couldn't read response", resp.Status)
	}
	return fmt.Errorf("failed to send webhook: %s, response: %s", resp.Status, string(bodyBytes))
}

type DefaultPayload struct {
	Level WebhookLevel        `json:"level"`
	Event schema.WebhookEvent `json:"event"`
	Data  WebhookData         `json:"data"`
}
