package schema

import (
	"reflect"

	"github.com/danielgtaylor/huma/v2"
)

// Enums
type WebhookTarget string

const (
	WebhookTargetDiscord  WebhookTarget = "discord"
	WebhookTargetSlack    WebhookTarget = "slack"
	WebhookTargetTelegram WebhookTarget = "telegram"
	WebhookTargetOther    WebhookTarget = "other"
)

var allWebhookTargets = []WebhookTarget{
	WebhookTargetDiscord,
	WebhookTargetSlack,
	WebhookTargetTelegram,
	WebhookTargetOther,
}

// Values provides list valid values for Enum.
func (s WebhookTarget) Values() (kinds []string) {
	for _, s := range allWebhookTargets {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u WebhookTarget) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["WebhookTarget"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "WebhookTarget")
		schemaRef.Title = "WebhookTarget"
		for _, v := range allWebhookTargets {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["WebhookTarget"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/WebhookTarget"}
}

// Type of webhook
type WebhookType string

const (
	WebhookTypeTeam    WebhookType = "team"
	WebhookTypeProject WebhookType = "project"
)

var allWebhookTypes = []WebhookType{
	WebhookTypeTeam,
	WebhookTypeProject,
}

// Values provides list valid values for Enum.
func (s WebhookType) Values() (kinds []string) {
	for _, s := range allWebhookTypes {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u WebhookType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["WebhookType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "WebhookType")
		schemaRef.Title = "WebhookType"
		for _, v := range allWebhookTypes {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["WebhookType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/WebhookType"}
}

// Webhook events
type WebhookEvent string

const (
	WebhookEventProjectCreated      WebhookEvent = "project.created"
	WebhookEventProjectUpdated      WebhookEvent = "project.updated"
	WebhookEventProjectDeleted      WebhookEvent = "project.deleted"
	WebhookEventServiceCreated      WebhookEvent = "service.created"
	WebhookEventServiceUpdated      WebhookEvent = "service.updated"
	WebhookEventServiceDeleted      WebhookEvent = "service.deleted"
	WebhookEventDeploymentQueued    WebhookEvent = "deployment.queued"
	WebhookEventDeploymentBuilding  WebhookEvent = "deployment.building"
	WebhookEventDeploymentSucceeded WebhookEvent = "deployment.succeeded"
	WebhookEventDeploymentFailed    WebhookEvent = "deployment.failed"
	WebhookEventDeploymentCancelled WebhookEvent = "deployment.cancelled"
)

var allWebhookEvents = []WebhookEvent{
	WebhookEventProjectCreated,
	WebhookEventProjectUpdated,
	WebhookEventProjectDeleted,
	WebhookEventServiceCreated,
	WebhookEventServiceUpdated,
	WebhookEventServiceDeleted,
	WebhookEventDeploymentQueued,
	WebhookEventDeploymentBuilding,
	WebhookEventDeploymentSucceeded,
	WebhookEventDeploymentFailed,
	WebhookEventDeploymentCancelled,
}

// Values provides list valid values for Enum.
func (s WebhookEvent) Values() (kinds []string) {
	for _, s := range allWebhookEvents {
		kinds = append(kinds, string(s))
	}
	return
}

// Schema registers the WebhookEvent schema in the OpenAPI specification
func (u WebhookEvent) Schema(r huma.Registry) *huma.Schema {
	// First register the base WebhookEvent enum type
	if r.Map()["WebhookEvent"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "WebhookEvent")
		schemaRef.Title = "WebhookEvent"
		for _, v := range allWebhookEvents {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["WebhookEvent"] = schemaRef
	}

	// Register WebhookTeamEvent schema with just team events
	if r.Map()["WebhookTeamEvent"] == nil {
		teamSchema := &huma.Schema{
			Title: "WebhookTeamEvent",
			Type:  "string",
			Enum: []interface{}{
				string(WebhookEventProjectCreated),
				string(WebhookEventProjectUpdated),
				string(WebhookEventProjectDeleted),
			},
		}
		r.Map()["WebhookTeamEvent"] = teamSchema
	}

	// Register WebhookProjectEvent schema with just project events
	if r.Map()["WebhookProjectEvent"] == nil {
		projectEvents := []interface{}{
			string(WebhookEventServiceCreated),
			string(WebhookEventServiceUpdated),
			string(WebhookEventServiceDeleted),
			string(WebhookEventDeploymentQueued),
			string(WebhookEventDeploymentBuilding),
			string(WebhookEventDeploymentSucceeded),
			string(WebhookEventDeploymentFailed),
			string(WebhookEventDeploymentCancelled),
		}

		projectSchema := &huma.Schema{
			Title: "WebhookProjectEvent",
			Type:  "string",
			Enum:  projectEvents,
		}
		r.Map()["WebhookProjectEvent"] = projectSchema
	}

	// Return a oneOf reference directly without creating an array
	return &huma.Schema{
		OneOf: []*huma.Schema{
			{Ref: "#/components/schemas/WebhookTeamEvent"},
			{Ref: "#/components/schemas/WebhookProjectEvent"},
		},
	}
}
