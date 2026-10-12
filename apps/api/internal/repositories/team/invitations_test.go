package team_repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type InvitationsSuite struct {
	repository.RepositoryBaseSuite
	teamRepo *TeamRepository
	team     *ent.Team
	inviter  *ent.User
}

func (suite *InvitationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.teamRepo = NewTeamRepository(suite.DB)
	suite.team = suite.DB.Team.Create().SetKubernetesName("acme-abc").SetName("Acme").SetNamespace("acme-abc").SetKubernetesSecret("acme-abc").SaveX(suite.Ctx)
	suite.inviter = suite.DB.User.Create().SetEmail("admin@example.com").SetPasswordHash("x").SaveX(suite.Ctx)
}

func (suite *InvitationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
}

func (suite *InvitationsSuite) invite(email, hash string, expiresAt time.Time) *ent.Invitation {
	inv, err := suite.teamRepo.CreateInvitation(suite.Ctx, &CreateInvitationInput{
		TeamID: suite.team.ID, Email: email, Role: schema.ActionEditor, TokenHash: hash, ExpiresAt: expiresAt, InvitedBy: suite.inviter.ID,
	})
	suite.Require().NoError(err)
	return inv
}

func (suite *InvitationsSuite) TestReinviteReplacesPendingAndListSkipsSpentOrExpired() {
	later := time.Now().Add(time.Hour)
	first := suite.invite("dev@example.com", "h1", later)
	second := suite.invite("Dev@example.com", "h2", later)
	accepted := suite.invite("done@example.com", "h3", later)
	suite.Require().NoError(suite.teamRepo.MarkInvitationAccepted(suite.Ctx, accepted.ID))
	suite.invite("late@example.com", "h4", time.Now().Add(-time.Minute))

	_, err := suite.teamRepo.GetInvitationByTokenHash(suite.Ctx, "h1")
	suite.True(ent.IsNotFound(err), "the first invitation was replaced")
	_ = first

	pending, err := suite.teamRepo.GetPendingInvitations(suite.Ctx, suite.team.ID)
	suite.Require().NoError(err)
	suite.Require().Len(pending, 1)
	suite.Equal(second.ID, pending[0].ID)

	suite.Require().NoError(suite.teamRepo.DeleteInvitation(suite.Ctx, suite.team.ID, second.ID))
	suite.True(ent.IsNotFound(suite.teamRepo.DeleteInvitation(suite.Ctx, uuid.New(), accepted.ID)), "another team cannot revoke it")
}

func TestInvitationsSuite(t *testing.T) {
	suite.Run(t, new(InvitationsSuite))
}
