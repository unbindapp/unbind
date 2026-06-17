package webhooks_service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

func (self *WebhooksService) sendDiscordWebhook(level WebhookLevel, event schema.WebhookEvent, data WebhookData, url string) error {
	// Convert to discord format
	fields := make([]DiscordField, len(data.Fields))
	embed := DiscordEmbed{
		Title:       &data.Title,
		Url:         &data.Url,
		Description: &data.Description,
		Color:       level.DecimalColor(),
		DiscordFooter: &DiscordFooter{
			Text: utils.ToPtr(fmt.Sprintf("%s | %s", time.Now().Format(time.RFC1123), event)),
		},
	}
	for i, entry := range data.Fields {
		fields[i] = DiscordField{
			Name:  &entry.Name,
			Value: &entry.Value,
		}
	}
	embed.DiscordFields = &fields

	// Execute
	msg := DiscordMessage{
		DiscordEmbeds: &[]DiscordEmbed{
			embed,
		},
	}

	payload := new(bytes.Buffer)
	err := json.NewEncoder(payload).Encode(msg)
	if err != nil {
		log.Errorf("Failed to encode discord webhook payload: %v", err)
		return err
	}

	req, err := http.NewRequest(http.MethodPost, url, payload)
	if err != nil {
		log.Errorf("Failed to create discord webhook request: %v", err)
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	// Do
	resp, err := self.httpClient.Do(req)
	if err != nil {
		log.Errorf("Failed to send discord webhook: %v", err)
		return err
	}

	if !slices.Contains([]int{http.StatusOK, http.StatusNoContent}, resp.StatusCode) {
		log.Errorf("Failed to send discord webhook: %v", resp.Status)
	}

	return nil
}

type DiscordMessage struct {
	Username        *string          `json:"username,omitempty"`
	AvatarUrl       *string          `json:"avatar_url,omitempty"`
	Content         *string          `json:"content,omitempty"`
	DiscordEmbeds   *[]DiscordEmbed  `json:"embeds,omitempty"`
	AllowedMentions *AllowedMentions `json:"allowed_mentions,omitempty"`
}

type DiscordEmbed struct {
	Title            *string           `json:"title,omitempty"`
	Url              *string           `json:"url,omitempty"`
	Description      *string           `json:"description,omitempty"`
	Color            *string           `json:"color,omitempty"`
	DiscordAuthor    *DiscordAuthor    `json:"author,omitempty"`
	DiscordFields    *[]DiscordField   `json:"fields,omitempty"`
	DiscordThumbnail *DiscordThumbnail `json:"thumbnail,omitempty"`
	DiscordImage     *DiscordImage     `json:"image,omitempty"`
	DiscordFooter    *DiscordFooter    `json:"footer,omitempty"`
}

type DiscordAuthor struct {
	Name    *string `json:"name,omitempty"`
	Url     *string `json:"url,omitempty"`
	IconUrl *string `json:"icon_url,omitempty"`
}

type DiscordField struct {
	Name   *string `json:"name,omitempty"`
	Value  *string `json:"value,omitempty"`
	Inline *bool   `json:"inline,omitempty"`
}

type DiscordThumbnail struct {
	Url *string `json:"url,omitempty"`
}

type DiscordImage struct {
	Url *string `json:"url,omitempty"`
}

type DiscordFooter struct {
	Text    *string `json:"text,omitempty"`
	IconUrl *string `json:"icon_url,omitempty"`
}

type AllowedMentions struct {
	Parse *[]string `json:"parse,omitempty"`
	Users *[]string `json:"users,omitempty"`
	Roles *[]string `json:"roles,omitempty"`
}
