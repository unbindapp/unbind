package team_repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/invitation"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type CreateInvitationInput struct {
	TeamID    uuid.UUID
	ProjectID *uuid.UUID
	Email     string
	Role      schema.PermittedAction
	TokenHash string
	ExpiresAt time.Time
	InvitedBy uuid.UUID
}

// CreateInvitation replaces any pending invitation for the same address on the
// same team or project.
func (self *TeamRepository) CreateInvitation(ctx context.Context, input *CreateInvitationInput) (*ent.Invitation, error) {
	_, err := self.base.DB.Invitation.Delete().
		Where(invitation.TeamID(input.TeamID), invitedTo(input.ProjectID), invitation.EmailEqualFold(input.Email), invitation.AcceptedAtIsNil()).
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return self.base.DB.Invitation.Create().
		SetTeamID(input.TeamID).
		SetNillableProjectID(input.ProjectID).
		SetEmail(input.Email).
		SetRole(input.Role).
		SetTokenHash(input.TokenHash).
		SetExpiresAt(input.ExpiresAt).
		SetInvitedBy(input.InvitedBy).
		Save(ctx)
}

func (self *TeamRepository) GetInvitationByTokenHash(ctx context.Context, tokenHash string) (*ent.Invitation, error) {
	return self.base.DB.Invitation.Query().
		Where(invitation.TokenHash(tokenHash)).
		WithTeam().
		WithProject().
		Only(ctx)
}

func (self *TeamRepository) GetPendingInvitations(ctx context.Context, teamID uuid.UUID, projectID *uuid.UUID) ([]*ent.Invitation, error) {
	return self.base.DB.Invitation.Query().
		Where(invitation.TeamID(teamID), invitedTo(projectID), invitation.AcceptedAtIsNil(), invitation.ExpiresAtGT(time.Now())).
		Order(ent.Asc(invitation.FieldEmail)).
		All(ctx)
}

func (self *TeamRepository) DeleteInvitation(ctx context.Context, teamID uuid.UUID, projectID *uuid.UUID, invitationID uuid.UUID) error {
	deleted, err := self.base.DB.Invitation.Delete().
		Where(invitation.ID(invitationID), invitation.TeamID(teamID), invitedTo(projectID)).
		Exec(ctx)
	if err != nil {
		return err
	}
	if deleted == 0 {
		return &ent.NotFoundError{}
	}
	return nil
}

func (self *TeamRepository) MarkInvitationAccepted(ctx context.Context, invitationID uuid.UUID) error {
	return self.base.DB.Invitation.UpdateOneID(invitationID).SetAcceptedAt(time.Now()).Exec(ctx)
}

func invitedTo(projectID *uuid.UUID) predicate.Invitation {
	if projectID == nil {
		return invitation.ProjectIDIsNil()
	}
	return invitation.ProjectID(*projectID)
}
