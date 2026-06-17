package webhooks_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestWebhooksService_DetectTargetFromURL(t *testing.T) {
	service := &WebhooksService{}

	tests := []struct {
		name     string
		url      string
		expected schema.WebhookTarget
		wantErr  bool
	}{
		// Discord webhook tests
		{
			name:     "Valid Discord webhook URL",
			url:      "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz1234567890",
			expected: schema.WebhookTargetDiscord,
			wantErr:  false,
		},
		{
			name:     "Valid Discord webhook URL with discordapp.com domain",
			url:      "https://discordapp.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz1234567890",
			expected: schema.WebhookTargetDiscord,
			wantErr:  false,
		},
		{
			name:     "Invalid Discord webhook URL - wrong path",
			url:      "https://discord.com/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz1234567890",
			expected: schema.WebhookTargetOther,
			wantErr:  false,
		},

		// Slack webhook tests
		{
			name:     "Valid Slack webhook URL with hooks.slack.com",
			url:      "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
			expected: schema.WebhookTargetSlack,
			wantErr:  false,
		},
		{
			name:     "Valid Slack webhook URL with company domain",
			url:      "https://company.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
			expected: schema.WebhookTargetSlack,
			wantErr:  false,
		},
		{
			name:     "Valid Slack webhook URL with additional path",
			url:      "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX/additional",
			expected: schema.WebhookTargetSlack, // Should still match the prefix pattern
			wantErr:  false,
		},
		{
			name:     "Valid Slack webhook URL with subdomain",
			url:      "https://workspace.enterprise.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
			expected: schema.WebhookTargetSlack,
			wantErr:  false,
		},

		// Edge cases and invalid URLs
		{
			name:     "Invalid URL format",
			url:      "not-a-url",
			expected: schema.WebhookTargetOther,
			wantErr:  true,
		},
		{
			name:     "Empty URL",
			url:      "",
			expected: schema.WebhookTargetOther,
			wantErr:  true,
		},
		{
			name:     "URL with no host",
			url:      "https:///api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz1234567890",
			expected: schema.WebhookTargetOther,
			wantErr:  true,
		},
		{
			name:     "Non-webhook domain",
			url:      "https://example.com/api/webhooks/123",
			expected: schema.WebhookTargetOther,
			wantErr:  false,
		},
		{
			name:     "Discord-like URL but not webhook",
			url:      "https://discord.com/channels/123456789012345678/123456789012345678",
			expected: schema.WebhookTargetOther,
			wantErr:  false,
		},
		{
			name:     "Slack-like URL but not webhook",
			url:      "https://workspace.slack.com/archives/C12345678",
			expected: schema.WebhookTargetOther,
			wantErr:  false,
		},

		// Special cases that might trigger false positives
		{
			name:     "URL with 'discord.com' in subdomain",
			url:      "https://fake-discord.com/api/webhooks/123456789012345678/abc",
			expected: schema.WebhookTargetOther,
			wantErr:  false,
		},
		{
			name:     "URL with 'slack.com' in path",
			url:      "https://example.com/slack.com/services/T00000000/B00000000/XXX",
			expected: schema.WebhookTargetOther,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, err := service.DetectTargetFromURL(tt.url)

			if tt.wantErr {
				assert.Error(t, err, "Expected error for URL: %s", tt.url)
			} else {
				assert.NoError(t, err, "Did not expect error for URL: %s", tt.url)
			}

			assert.Equal(t, tt.expected, target, "Expected target %v for URL: %s, got: %v",
				tt.expected, tt.url, target)
		})
	}
}

// TestWebhooksService_DetectTargetFromURL_EdgeCases tests specific edge cases
func TestWebhooksService_DetectTargetFromURL_EdgeCases(t *testing.T) {
	service := &WebhooksService{}

	// Test case sensitive matching for Discord
	discordLowercase := "https://discord.com/api/webhooks/123/abc"
	target, err := service.DetectTargetFromURL(discordLowercase)
	assert.NoError(t, err)
	assert.Equal(t, schema.WebhookTargetDiscord, target, "Should detect lowercase Discord URL")

	// Test case sensitivity for Slack regex
	slackMixedCase := "https://hooks.slack.com/services/T00000000/B00000000/XxXxXxXxXxXx"
	target, err = service.DetectTargetFromURL(slackMixedCase)
	assert.NoError(t, err)
	assert.Equal(t, schema.WebhookTargetSlack, target, "Should detect mixed case Slack token")

	// Test with query parameters
	discordWithParams := "https://discord.com/api/webhooks/123/abc?wait=true&thread_id=1234567890"
	target, err = service.DetectTargetFromURL(discordWithParams)
	assert.NoError(t, err)
	assert.Equal(t, schema.WebhookTargetDiscord, target, "Should detect Discord URL with query parameters")

	// Test with URL fragment
	slackWithFragment := "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX#section1"
	target, err = service.DetectTargetFromURL(slackWithFragment)
	assert.NoError(t, err)
	assert.Equal(t, schema.WebhookTargetSlack, target, "Should detect Slack URL with fragment")
}
