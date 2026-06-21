package webhooks_service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// Alternative implementation using pre-formatted text blocks with monospace fonts
// to create a more visually distinctive notification similar to Discord embeds
func (self *WebhooksService) sendTelegramWebhook(level WebhookLevel, event schema.WebhookEvent, data WebhookData, botURL string) error {
	// Extract chat_id from the URL
	parsedURL, err := url.Parse(botURL)
	if err != nil {
		log.Errorf("Failed to parse Telegram webhook URL: %v", err)
		return err
	}

	// Extract chat_id and remove it from the URL
	queryParams := parsedURL.Query()
	chatID := queryParams.Get("chat_id")

	// Rewrite URL without chat_id
	queryParams.Del("chat_id")
	parsedURL.RawQuery = queryParams.Encode()
	botURL = parsedURL.String()

	messageText := fmt.Sprintf("%s <b>%s: %s</b>\n\n", level.Emoji(), string(level), event)

	// Wrap in card
	cardContent := ""

	if data.Title != "" {
		cardContent += fmt.Sprintf("Title: %s\n", data.Title)
	}
	if data.Url != "" {
		cardContent += fmt.Sprintf("Link: %s\n", data.Url)
	}

	if data.Description != "" {
		cardContent += fmt.Sprintf("\n%s\n", data.Description)
	}

	if len(data.Fields) > 0 {
		cardContent += "\nDetails:\n"
		for _, field := range data.Fields {
			cardContent += fmt.Sprintf("• %s: %s\n", field.Name, field.Value)
		}
	}

	if cardContent != "" {
		messageText += fmt.Sprintf("<pre>%s</pre>\n", cardContent)
	}

	messageText += fmt.Sprintf("<i>Sent: %s</i>", time.Now().Format(time.RFC1123))

	payload := TelegramPayload{
		ChatID:                chatID,
		Text:                  messageText,
		ParseMode:             "HTML",
		DisableWebPagePreview: true,
	}

	payloadBytes := new(bytes.Buffer)
	err = json.NewEncoder(payloadBytes).Encode(payload)
	if err != nil {
		log.Errorf("Failed to encode Telegram webhook payload: %v", err)
		return err
	}

	req, err := http.NewRequest(http.MethodPost, botURL, payloadBytes)
	if err != nil {
		log.Errorf("Failed to create Telegram webhook request: %v", err)
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := self.httpClient.Do(req)
	if err != nil {
		log.Errorf("Failed to send Telegram webhook: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to send Telegram webhook: %s", resp.Status)
	}

	return nil
}

type TelegramPayload struct {
	ChatID                string `json:"chat_id"`
	Text                  string `json:"text"`
	ParseMode             string `json:"parse_mode,omitempty"`
	DisableWebPagePreview bool   `json:"disable_web_page_preview,omitempty"`
	DisableNotification   bool   `json:"disable_notification,omitempty"`
	ReplyToMessageID      int    `json:"reply_to_message_id,omitempty"`
}
