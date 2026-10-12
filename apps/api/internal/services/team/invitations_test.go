package team_service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/mail"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
	"github.com/unbindapp/unbind-api/internal/services"
)

type stubMailer struct {
	configured bool
	sent       []mail.Content
}

func (m *stubMailer) Send(_ context.Context, _ string, content mail.Content) (bool, error) {
	if !m.configured {
		return false, nil
	}
	m.sent = append(m.sent, content)
	return true, nil
}

type InvitationsSuite struct {
	services.ServiceTestSuite
	service *TeamService
	mailer  *stubMailer
	adminID uuid.UUID
	team    *ent.Team
	groups  []*ent.Group
}

func (suite *InvitationsSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.mailer = &stubMailer{}
	suite.service = &TeamService{cfg: &config.Config{ExternalUIUrl: "https://unbind.example"}, repo: suite.MockRepo, mailer: suite.mailer}
	suite.adminID = uuid.New()
	suite.team = &ent.Team{ID: uuid.New(), Name: "Acme"}
	for _, role := range []schema.PermittedAction{schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer} {
		suite.groups = append(suite.groups, &ent.Group{ID: uuid.New(), TeamID: &suite.team.ID, Role: new(role)})
	}
}

func (suite *InvitationsSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *InvitationsSuite) expectAdmin() {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.adminID, []permissions_repo.PermissionCheck{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeTeam, ResourceID: suite.team.ID}}).
		Return(nil)
}

func (suite *InvitationsSuite) TestNewAddressGetsLinkAndHashedToken() {
	suite.expectAdmin()
	suite.MockTeamRepo.EXPECT().GetByID(suite.Ctx, suite.team.ID).Return(suite.team, nil).Once()
	suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.adminID).Return(&ent.User{ID: suite.adminID, Email: "admin@example.com"}, nil).Once()
	suite.MockUserRepo.EXPECT().GetByEmail(suite.Ctx, "new@example.com").Return(nil, &ent.NotFoundError{}).Once()

	var stored *team_repo.CreateInvitationInput
	suite.MockTeamRepo.EXPECT().CreateInvitation(suite.Ctx, mock.Anything).
		RunAndReturn(func(_ context.Context, in *team_repo.CreateInvitationInput) (*ent.Invitation, error) {
			stored = in
			return &ent.Invitation{ID: uuid.New(), TeamID: in.TeamID, Email: in.Email, Role: in.Role, ExpiresAt: in.ExpiresAt}, nil
		}).Once()

	result, err := suite.service.InviteMember(suite.Ctx, suite.adminID, &InviteMemberInput{TeamID: suite.team.ID, Email: " New@Example.com ", Role: schema.ActionViewer})
	suite.Require().NoError(err)
	suite.Nil(result.Member)
	suite.False(result.Invitation.EmailSent, "no relay configured")

	token := strings.TrimPrefix(result.Invitation.InviteURL, "https://unbind.example/invite/")
	suite.NotEqual(result.Invitation.InviteURL, token)
	suite.Equal(hashInvitationToken(token), stored.TokenHash, "only the hash is stored")
	suite.Equal("new@example.com", stored.Email)
	suite.WithinDuration(time.Now().Add(invitationTTL), stored.ExpiresAt, time.Minute)
}

func (suite *InvitationsSuite) TestExistingAccountIsAddedAndNotified() {
	existing := &ent.User{ID: uuid.New(), Email: "dev@example.com"}
	suite.mailer.configured = true
	suite.expectAdmin()
	suite.MockTeamRepo.EXPECT().GetByID(suite.Ctx, suite.team.ID).Return(suite.team, nil).Once()
	suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.adminID).Return(&ent.User{ID: suite.adminID, Email: "admin@example.com"}, nil).Once()
	suite.MockUserRepo.EXPECT().GetByEmail(suite.Ctx, "dev@example.com").Return(existing, nil).Twice()
	suite.MockTeamRepo.EXPECT().GetRoleGroups(suite.Ctx, suite.team.ID).Return(suite.groups, nil).Once()
	suite.MockGroupRepo.EXPECT().AddUser(suite.Ctx, suite.groups[1].ID, existing.ID).Return(nil).Once()

	result, err := suite.service.InviteMember(suite.Ctx, suite.adminID, &InviteMemberInput{TeamID: suite.team.ID, Email: "dev@example.com", Role: schema.ActionEditor})
	suite.Require().NoError(err)
	suite.Nil(result.Invitation)
	suite.Equal(schema.ActionEditor, result.Member.Role)
	suite.Require().Len(suite.mailer.sent, 1)
	suite.Equal("https://unbind.example/"+suite.team.ID.String(), suite.mailer.sent[0].ButtonURL)
}

func (suite *InvitationsSuite) TestAcceptCreatesAccountAndSpendsToken() {
	token, hash, err := newInvitationToken()
	suite.Require().NoError(err)
	invitation := &ent.Invitation{ID: uuid.New(), TeamID: suite.team.ID, Email: "new@example.com", Role: schema.ActionViewer, ExpiresAt: time.Now().Add(time.Hour)}
	invitation.Edges.Team = suite.team
	created := &ent.User{ID: uuid.New(), Email: "new@example.com"}

	suite.MockTeamRepo.EXPECT().GetInvitationByTokenHash(suite.Ctx, hash).Return(invitation, nil).Once()
	suite.MockUserRepo.EXPECT().GetByEmail(suite.Ctx, "new@example.com").Return(nil, &ent.NotFoundError{}).Once()
	suite.MockUserRepo.EXPECT().Create(suite.Ctx, "new@example.com", "correct horse").Return(created, nil).Once()
	suite.MockTeamRepo.EXPECT().GetRoleGroups(suite.Ctx, suite.team.ID).Return(suite.groups, nil).Once()
	suite.MockGroupRepo.EXPECT().AddUser(suite.Ctx, suite.groups[2].ID, created.ID).Return(nil).Once()
	suite.MockTeamRepo.EXPECT().MarkInvitationAccepted(suite.Ctx, invitation.ID).Return(nil).Once()

	user, err := suite.service.AcceptInvitation(suite.Ctx, &AcceptInvitationInput{Token: token, Password: "correct horse"})
	suite.Require().NoError(err)
	suite.Equal(created.ID, user.ID)
}

func (suite *InvitationsSuite) TestAcceptRefusesSpentExpiredOrUnknownTokens() {
	spent := &ent.Invitation{AcceptedAt: new(time.Now()), ExpiresAt: time.Now().Add(time.Hour)}
	spent.Edges.Team = suite.team
	expired := &ent.Invitation{ExpiresAt: time.Now().Add(-time.Minute)}
	expired.Edges.Team = suite.team

	for name, inv := range map[string]*ent.Invitation{"spent": spent, "expired": expired, "unknown": nil} {
		suite.Run(name, func() {
			call := suite.MockTeamRepo.EXPECT().GetInvitationByTokenHash(suite.Ctx, hashInvitationToken(name)).Once()
			if inv == nil {
				call.Return(nil, &ent.NotFoundError{})
			} else {
				call.Return(inv, nil)
			}
			_, err := suite.service.AcceptInvitation(suite.Ctx, &AcceptInvitationInput{Token: name, Password: "correct horse"})
			suite.ErrorIs(err, errdefs.ErrNotFound)
		})
	}
}

func TestInvitationsSuite(t *testing.T) {
	suite.Run(t, new(InvitationsSuite))
}
