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
	TeamID    uuid.UUID              `json:"team_id" format:"uuid" required:"true"`
	ProjectID *uuid.UUID             `json:"project_id,omitempty" format:"uuid" required:"false" doc:"Set to invite to this project of the team only"`
	Email     string                 `json:"email" format:"email" required:"true"`
	Role      schema.PermittedAction `json:"role" required:"true" doc:"admin, editor or viewer on this team or project"`
}

type RevokeInvitationInput struct {
	TeamID       uuid.UUID  `json:"team_id" format:"uuid" required:"true"`
	ProjectID    *uuid.UUID `json:"project_id,omitempty" format:"uuid" required:"false" doc:"Set when the invitation is to this project of the team"`
	InvitationID uuid.UUID  `json:"invitation_id" format:"uuid" required:"true"`
}

type AcceptInvitationInput struct {
	Token    string `json:"token" required:"true" minLength:"1"`
	Password string `json:"password" required:"false" minLength:"8" doc:"Required unless an account with the invited email already exists"`
}

// InviteMember adds an existing account to the team or project at once, or
// records an invitation for a new one and mails the link when a relay is
// configured. The link always comes back to the inviter so it can be shared by hand.
func (self *TeamService) InviteMember(ctx context.Context, requesterUserID uuid.UUID, input *InviteMemberInput) (*models.InviteMemberResponse, error) {
	if err := validateMemberRole(input.Role); err != nil {
		return nil, err
	}
	project, err := self.authorize(ctx, requesterUserID, schema.ActionAdmin, input.TeamID, input.ProjectID)
	if err != nil {
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
	joined := self.newJoinedResource(team, project)

	_, err = self.repo.User().GetByEmail(ctx, email)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	if err == nil {
		member, err := self.AddMember(ctx, requesterUserID, &TeamMemberAddInput{TeamID: input.TeamID, ProjectID: input.ProjectID, Email: email, Role: input.Role})
		if err != nil {
			return nil, err
		}
		self.notifyAdded(ctx, member.Email, joined, inviter.Email, input.Role)
		return &models.InviteMemberResponse{Member: member}, nil
	}

	token, tokenHash, err := newInvitationToken()
	if err != nil {
		return nil, err
	}
	invitation, err := self.repo.Team().CreateInvitation(ctx, &team_repo.CreateInvitationInput{
		TeamID:    input.TeamID,
		ProjectID: input.ProjectID,
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
		Subject:     fmt.Sprintf("%s invited you to %s on Unbind", inviter.Email, joined.name),
		Heading:     fmt.Sprintf("Join %s", joined.name),
		Paragraphs:  []string{fmt.Sprintf("%s invited you to %s as %s.", inviter.Email, joined.description, input.Role), "Accept the invitation to create your account and get started."},
		ButtonLabel: "Accept invitation",
		ButtonURL:   resp.InviteURL,
		Note:        "This invitation expires in 7 days. If you were not expecting it, you can ignore this email.",
	})
	if err != nil {
		log.Warnf("Failed to email invitation to %s: %v", email, err)
	}
	return &models.InviteMemberResponse{Invitation: resp}, nil
}

func (self *TeamService) ListInvitations(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID, projectID *uuid.UUID) ([]*models.InvitationResponse, error) {
	if _, err := self.authorize(ctx, requesterUserID, schema.ActionAdmin, teamID, projectID); err != nil {
		return nil, err
	}
	invitations, err := self.repo.Team().GetPendingInvitations(ctx, teamID, projectID)
	if err != nil {
		return nil, err
	}
	return models.TransformInvitationEntities(invitations), nil
}

func (self *TeamService) RevokeInvitation(ctx context.Context, requesterUserID uuid.UUID, input *RevokeInvitationInput) error {
	if _, err := self.authorize(ctx, requesterUserID, schema.ActionAdmin, input.TeamID, input.ProjectID); err != nil {
		return err
	}
	return self.repo.Team().DeleteInvitation(ctx, input.TeamID, input.ProjectID, input.InvitationID)
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
	preview := &models.InvitationPreviewResponse{
		Email:         invitation.Email,
		TeamName:      invitation.Edges.Team.Name,
		Role:          invitation.Role,
		ExpiresAt:     invitation.ExpiresAt,
		AccountExists: err == nil,
	}
	if invitation.Edges.Project != nil {
		preview.ProjectName = &invitation.Edges.Project.Name
	}
	return preview, nil
}

// AcceptInvitation is public. It creates the account when none exists for the
// invited email, puts it on the team or project at the invited role and spends
// the token.
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

	roleGroups, err := self.roleGroupsToJoin(ctx, invitation.TeamID, invitation.Edges.Project)
	if err != nil {
		return nil, err
	}
	if groupHoldingUser(roleGroups, user.ID) == nil {
		target := roleGroup(roleGroups, invitation.Role)
		if target == nil {
			return nil, missingRoleGroup(invitation.TeamID, invitation.ProjectID, invitation.Role)
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
	if invitation.ProjectID != nil && invitation.Edges.Project == nil {
		return nil, invalid
	}
	return invitation, nil
}

type joinedResource struct {
	kind        string
	name        string
	description string
	url         string
}

func (self *TeamService) newJoinedResource(team *ent.Team, project *ent.Project) joinedResource {
	if project == nil {
		url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, team.ID.String())
		return joinedResource{kind: "team", name: team.Name, description: fmt.Sprintf("the team %s", team.Name), url: url}
	}
	url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, team.ID.String(), "project", project.ID.String())
	return joinedResource{kind: "project", name: project.Name, description: fmt.Sprintf("the project %s in the team %s", project.Name, team.Name), url: url}
}

func (self *TeamService) notifyAdded(ctx context.Context, to string, joined joinedResource, by string, role schema.PermittedAction) {
	_, err := self.mailer.Send(ctx, to, mail.Content{
		Subject:     fmt.Sprintf("You were added to %s on Unbind", joined.name),
		Heading:     fmt.Sprintf("You are now on %s", joined.name),
		Paragraphs:  []string{fmt.Sprintf("%s added you to %s as %s.", by, joined.description, role)},
		ButtonLabel: fmt.Sprintf("Open the %s", joined.kind),
		ButtonURL:   joined.url,
	})
	if err != nil {
		log.Warnf("Failed to email %s notification to %s: %v", joined.kind, to, err)
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
