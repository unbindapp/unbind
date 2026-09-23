package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type APIKeyCreateInput struct {
	Name         string                  `json:"name" required:"true" minLength:"1" maxLength:"100"`
	ExpiresAt    *time.Time              `json:"expires_at,omitempty" required:"false" doc:"When the key stops working. Omit for a key that never expires."`
	Role         schema.PermittedAction  `json:"role" required:"true" doc:"Strongest action the key can perform. Never exceeds what you hold on a resource."`
	FullAccess   bool                    `json:"full_access" required:"true" doc:"Reach everything you can, capped at role. Resources must be empty."`
	Resources    []schema.APIKeyResource `json:"resources" required:"true" nullable:"false" doc:"Resources the key is limited to, each reaching everything below it. Required unless full_access."`
	Capabilities []schema.KeyCapability  `json:"capabilities,omitempty" required:"false" nullable:"false" doc:"What the key may see beyond its role: read_variable_values, read_logs, read_webhook_urls. All off when omitted."`
}

type APIKeyListInput struct {
	UserID uuid.UUID `query:"user_id" format:"uuid" required:"false" doc:"List another user's keys. Requires system admin. Defaults to your own."`
}

type APIKeyDeleteInput struct {
	ID uuid.UUID `json:"id" format:"uuid" required:"true"`
}
