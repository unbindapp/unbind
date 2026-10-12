package team_service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/mail"
	"github.com/unbindapp/unbind-api/internal/models"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
)

const invitationTTL = 7 * 24 * time.Hour

// Mailer sends one message and reports whether it went out; the email service
// implements it and returns false without error when no relay is configured.
type Mailer interface {
	Send(ctx context.Context, to string, content mail.Content) (sent bool, err error)
}

type InviteMemberInput struct {
	TeamID uuid.UUID              `json:"team_id" format:"uuid" required:"true"`
	Email  string                 `json:"email" format:"email" required:"true"`
	Role   schema.PermittedAction `json:"role" required:"true" doc:"admin, editor or viewer on this team"`
}

type RevokeInvitationInput struct {
	TeamID       uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	InvitationID uuid.UUID `json:"invitation_id" format:"uuid" required:"true"`
}

type AcceptInvitationInput struct {
	Token    string `json:"token" required:"true" minLength:"1"`
	Password string `json:"password" required:"false" minLength:"8" doc:"Required unless an account with the invited email already exists"`
}

// InviteMember adds an existing account to the team at once, or records an
// invitation for a new one and mails the link when a relay is configured. The
// link always comes back to the inviter so it can be shared by hand.
func (self *TeamService) InviteMember(ctx context.Context, requesterUserID uuid.UUID, input *InviteMemberInput) (*models.InviteMemberResponse, error) {
	if err := validateMemberRole(input.Role); err != nil {
		return nil, err
	}
	if err := self.checkTeam(ctx, requesterUserID, schema.ActionAdmin, input.TeamID); err != nil {
		return nil, err
	}
	email := strings.TrimSpace(strings.ToLower(input.Email))

	team, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		return nil, errdefs.MaskAsNotFound(err, "Team not found")
	}
	inviter, err := self.repo.User().GetByID(ctx, requesterUserID)
	if err != nil {
		return nil, err
	}

	_, err = self.repo.User().GetByEmail(ctx, email)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	if err == nil {
		member, err := self.AddMember(ctx, requesterUserID, &TeamMemberAddInput{TeamID: input.TeamID, Email: email, Role: input.Role})
		if err != nil {
			return nil, err
		}
		self.notifyAdded(ctx, member.Email, team, inviter.Email, input.Role)
		return &models.InviteMemberResponse{Member: member}, nil
	}

	token, tokenHash, err := newInvitationToken()
	if err != nil {
		return nil, err
	}
	invitation, err := self.repo.Team().CreateInvitation(ctx, &team_repo.CreateInvitationInput{
		TeamID:    input.TeamID,
		Email:     email,
		Role:      input.Role,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(invitationTTL),
		InvitedBy: requesterUserID,
	})
	if err != nil {
		return nil, err
	}

	resp := models.TransformInvitationEntity(invitation)
	resp.InviteURL, _ = utils.JoinURLPaths(self.cfg.ExternalUIUrl, "invite", token)
	resp.EmailSent, err = self.mailer.Send(ctx, email, mail.Content{
		Subject:     fmt.Sprintf("%s invited you to %s on Unbind", inviter.Email, team.Name),
		Heading:     fmt.Sprintf("Join %s", team.Name),
		Paragraphs:  []string{fmt.Sprintf("%s invited you to the team %s as %s.", inviter.Email, team.Name, input.Role), "Accept the invitation to create your account and get started."},
		ButtonLabel: "Accept invitation",
		ButtonURL:   resp.InviteURL,
		Note:        "This invitation expires in 7 days. If you were not expecting it, you can ignore this email.",
	})
	if err != nil {
		log.Warnf("Failed to email invitation to %s: %v", email, err)
	}
	return &models.InviteMemberResponse{Invitation: resp}, nil
}

func (self *TeamService) ListInvitations(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID) ([]*models.InvitationResponse, error) {
	if err := self.checkTeam(ctx, requesterUserID, schema.ActionAdmin, teamID); err != nil {
		return nil, err
	}
	invitations, err := self.repo.Team().GetPendingInvitations(ctx, teamID)
	if err != nil {
		return nil, err
	}
	return models.TransformInvitationEntities(invitations), nil
}

func (self *TeamService) RevokeInvitation(ctx context.Context, requesterUserID uuid.UUID, input *RevokeInvitationInput) error {
	if err := self.checkTeam(ctx, requesterUserID, schema.ActionAdmin, input.TeamID); err != nil {
		return err
	}
	return self.repo.Team().DeleteInvitation(ctx, input.TeamID, input.InvitationID)
}

// GetInvitation is public: holding the token is the only credential.
func (self *TeamService) GetInvitation(ctx context.Context, token string) (*models.InvitationPreviewResponse, error) {
	invitation, err := self.pendingInvitation(ctx, token)
	if err != nil {
		return nil, err
	}
	_, err = self.repo.User().GetByEmail(ctx, invitation.Email)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	return &models.InvitationPreviewResponse{
		Email:         invitation.Email,
		TeamName:      invitation.Edges.Team.Name,
		Role:          invitation.Role,
		ExpiresAt:     invitation.ExpiresAt,
		AccountExists: err == nil,
	}, nil
}

// AcceptInvitation is public. It creates the account when none exists for the
// invited email, puts it on the team at the invited role and spends the token.
func (self *TeamService) AcceptInvitation(ctx context.Context, input *AcceptInvitationInput) (*models.UserResponse, error) {
	invitation, err := self.pendingInvitation(ctx, input.Token)
	if err != nil {
		return nil, err
	}

	user, err := self.repo.User().GetByEmail(ctx, invitation.Email)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	if ent.IsNotFound(err) {
		if input.Password == "" {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "A password is required to create your account")
		}
		user, err = self.repo.User().Create(ctx, invitation.Email, input.Password)
		if err != nil {
			return nil, err
		}
	}

	roleGroups, err := self.repo.Team().GetRoleGroups(ctx, invitation.TeamID)
	if err != nil {
		return nil, err
	}
	if groupHoldingUser(roleGroups, user.ID) == nil {
		target := roleGroup(roleGroups, invitation.Role)
		if target == nil {
			return nil, fmt.Errorf("team %s has no %s role group", invitation.TeamID, invitation.Role)
		}
		if err := self.repo.Group().AddUser(ctx, target.ID, user.ID); err != nil {
			return nil, err
		}
	}

	if err := self.repo.Team().MarkInvitationAccepted(ctx, invitation.ID); err != nil {
		return nil, err
	}
	return models.TransformUserEntity(user), nil
}

func (self *TeamService) pendingInvitation(ctx context.Context, token string) (*ent.Invitation, error) {
	invalid := errdefs.NewCustomError(errdefs.ErrTypeNotFound, "This invitation is no longer valid")
	invitation, err := self.repo.Team().GetInvitationByTokenHash(ctx, hashInvitationToken(token))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, invalid
		}
		return nil, err
	}
	if invitation.AcceptedAt != nil || time.Now().After(invitation.ExpiresAt) || invitation.Edges.Team == nil {
		return nil, invalid
	}
	return invitation, nil
}

func (self *TeamService) notifyAdded(ctx context.Context, to string, team *ent.Team, by string, role schema.PermittedAction) {
	url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, team.ID.String())
	_, err := self.mailer.Send(ctx, to, mail.Content{
		Subject:     fmt.Sprintf("You were added to %s on Unbind", team.Name),
		Heading:     fmt.Sprintf("You are now on %s", team.Name),
		Paragraphs:  []string{fmt.Sprintf("%s added you to the team %s as %s.", by, team.Name, role)},
		ButtonLabel: "Open the team",
		ButtonURL:   url,
	})
	if err != nil {
		log.Warnf("Failed to email team notification to %s: %v", to, err)
	}
}

func newInvitationToken() (token, tokenHash string, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(raw)
	return token, hashInvitationToken(token), nil
}

func hashInvitationToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
