package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type ConnectedAppClientInput struct {
	ClientID    string `query:"client_id" required:"true" maxLength:"512"`
	RedirectURI string `query:"redirect_uri" required:"true" maxLength:"512"`
}

// ConnectedAppApproveInput repeats the authorization request so approval is
// validated against the registered client again, not against what the page saw.
type ConnectedAppApproveInput struct {
	ClientID      string                  `json:"client_id" required:"true" maxLength:"512"`
	RedirectURI   string                  `json:"redirect_uri" required:"true" maxLength:"512"`
	State         string                  `json:"state,omitempty" required:"false" maxLength:"1024"`
	CodeChallenge string                  `json:"code_challenge" required:"true" minLength:"43" maxLength:"128"`
	Resource      string                  `json:"resource,omitempty" required:"false" maxLength:"512"`
	Scope         string                  `json:"scope,omitempty" required:"false" maxLength:"512"`
	Role          schema.PermittedAction  `json:"role" required:"true" doc:"Strongest action the app can perform. Never exceeds what you hold on a resource."`
	FullAccess    bool                    `json:"full_access" required:"true" doc:"Reach everything you can, capped at role. Resources must be empty."`
	Resources     []schema.APIKeyResource `json:"resources" required:"true" nullable:"false" doc:"Resources the app is limited to. Required unless full_access."`
	Capabilities  []schema.KeyCapability  `json:"capabilities,omitempty" required:"false" nullable:"false" doc:"What the app may see beyond its role: read_variable_values, read_logs, read_webhook_urls. All off when omitted."`
}

type ConnectedAppDenyInput struct {
	ClientID    string `json:"client_id" required:"true" maxLength:"512"`
	RedirectURI string `json:"redirect_uri" required:"true" maxLength:"512"`
	State       string `json:"state,omitempty" required:"false" maxLength:"1024"`
}

type ConnectedAppRevokeInput struct {
	ID uuid.UUID `json:"id" format:"uuid" required:"true"`
}
