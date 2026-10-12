package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type InvitationResponse struct {
	ID        uuid.UUID              `json:"id" format:"uuid"`
	TeamID    uuid.UUID              `json:"team_id" format:"uuid"`
	Email     string                 `json:"email"`
	Role      schema.PermittedAction `json:"role"`
	ExpiresAt time.Time              `json:"expires_at"`
	CreatedAt time.Time              `json:"created_at"`
	InviteURL string                 `json:"invite_url,omitempty" doc:"The link to share. Only returned when the invitation is created."`
	EmailSent bool                   `json:"email_sent" doc:"Whether the link was also emailed. False when no mail relay is configured."`
}

func TransformInvitationEntity(entity *ent.Invitation) *InvitationResponse {
	return &InvitationResponse{
		ID:        entity.ID,
		TeamID:    entity.TeamID,
		Email:     entity.Email,
		Role:      entity.Role,
		ExpiresAt: entity.ExpiresAt,
		CreatedAt: entity.CreatedAt,
	}
}

func TransformInvitationEntities(entities []*ent.Invitation) []*InvitationResponse {
	responses := make([]*InvitationResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformInvitationEntity(entity)
	}
	return responses
}

// InviteMemberResponse holds the member when the address already had an account
// and was added straight away, else the invitation that was created.
type InviteMemberResponse struct {
	Member     *TeamMemberResponse `json:"member,omitempty" required:"false"`
	Invitation *InvitationResponse `json:"invitation,omitempty" required:"false"`
}

// InvitationPreviewResponse is what the invitee sees before accepting.
type InvitationPreviewResponse struct {
	Email         string                 `json:"email"`
	TeamName      string                 `json:"team_name"`
	Role          schema.PermittedAction `json:"role"`
	ExpiresAt     time.Time              `json:"expires_at"`
	AccountExists bool                   `json:"account_exists" doc:"True when an account with this email already exists, so accepting only adds it to the team"`
}
