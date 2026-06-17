package webhooks_service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

func (self *WebhooksService) sendSlackWebhook(level WebhookLevel, event schema.WebhookEvent, data WebhookData, url string) error {
	// Convert to slack format
	fields := make([]*SlackField, len(data.Fields))
	for i, entry := range data.Fields {
		fields[i] = &SlackField{
			Title: entry.Name,
			Value: entry.Value,
			Short: false,
		}
	}

	// Create timestamp for footer
	timestamp := time.Now().Unix()

	// Create the attachment
	attachment := SlackAttachment{
		Fallback:    &data.Description,
		Color:       level.HexColor(),
		Title:       &data.Title,
		TitleLink:   &data.Url,
		Text:        &data.Description,
		SlackFields: fields,
		Footer:      utils.ToPtr(string(event)),
		Timestamp:   &timestamp,
		MarkdownIn:  &[]string{"text", "fields"},
	}

	// Create the payload
	msg := SlackPayload{
		SlackAttachments: []SlackAttachment{attachment},
		Markdown:         true,
	}

	// Encode the payload
	payload := new(bytes.Buffer)
	err := json.NewEncoder(payload).Encode(msg)
	if err != nil {
		log.Errorf("Failed to encode slack webhook payload: %v", err)
		return err
	}

	// Create the request
	req, err := http.NewRequest(http.MethodPost, url, payload)
	if err != nil {
		log.Errorf("Failed to create slack webhook request: %v", err)
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	// Send the request
	resp, err := self.httpClient.Do(req)
	if err != nil {
		log.Errorf("Failed to send slack webhook: %v", err)
		return err
	}
	defer resp.Body.Close()

	// Check response
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to send slack webhook: %s", resp.Status)
	}

	return nil
}

type SlackField struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Short bool   `json:"short"`
}

type SlackAction struct {
	Type  string `json:"type"`
	Text  string `json:"text"`
	Url   string `json:"url"`
	Style string `json:"style"`
}

type SlackAttachment struct {
	Fallback     *string        `json:"fallback"`
	Color        *string        `json:"color"`
	PreText      *string        `json:"pretext"`
	AuthorName   *string        `json:"author_name"`
	AuthorLink   *string        `json:"author_link"`
	AuthorIcon   *string        `json:"author_icon"`
	Title        *string        `json:"title"`
	TitleLink    *string        `json:"title_link"`
	Text         *string        `json:"text"`
	ImageUrl     *string        `json:"image_url"`
	SlackFields  []*SlackField  `json:"fields"`
	Footer       *string        `json:"footer"`
	FooterIcon   *string        `json:"footer_icon"`
	Timestamp    *int64         `json:"ts"`
	MarkdownIn   *[]string      `json:"mrkdwn_in"`
	SlackActions []*SlackAction `json:"actions"`
	CallbackID   *string        `json:"callback_id"`
	ThumbnailUrl *string        `json:"thumb_url"`
}

type SlackPayload struct {
	Parse            string            `json:"parse,omitempty"`
	Username         string            `json:"username,omitempty"`
	IconUrl          string            `json:"icon_url,omitempty"`
	IconEmoji        string            `json:"icon_emoji,omitempty"`
	Channel          string            `json:"channel,omitempty"`
	Text             string            `json:"text,omitempty"`
	LinkNames        string            `json:"link_names,omitempty"`
	SlackAttachments []SlackAttachment `json:"attachments,omitempty"`
	UnfurlLinks      bool              `json:"unfurl_links,omitempty"`
	UnfurlMedia      bool              `json:"unfurl_media,omitempty"`
	Markdown         bool              `json:"mrkdwn,omitempty"`
}
