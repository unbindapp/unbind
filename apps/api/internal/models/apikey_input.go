package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type APIKeyCreateInput struct {
	Name      string               `json:"name" required:"true" minLength:"1" maxLength:"100"`
	ExpiresAt *time.Time           `json:"expires_at,omitempty" required:"false" doc:"When the key stops working. Omit for a key that never expires."`
	Scopes    []schema.APIKeyScope `json:"scopes" required:"true" minItems:"1" nullable:"false" doc:"Grants the key carries. Each must be within what you can already do."`
}

type APIKeyListInput struct {
	UserID uuid.UUID `query:"user_id" format:"uuid" required:"false" doc:"List another user's keys. Requires system admin. Defaults to your own."`
}

type APIKeyDeleteInput struct {
	ID uuid.UUID `json:"id" format:"uuid" required:"true"`
}
