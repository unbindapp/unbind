package team_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/teamicon"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type TeamIconSuite struct {
	repository.RepositoryBaseSuite
	teamRepo *TeamRepository
	team     *ent.Team
}

func (suite *TeamIconSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.teamRepo = NewTeamRepository(suite.DB)
	suite.team = suite.DB.Team.Create().SetKubernetesName("acme-abc").SetName("Acme").SetNamespace("acme-abc").SetKubernetesSecret("acme-abc").SaveX(suite.Ctx)
}

func (suite *TeamIconSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
}

func (suite *TeamIconSuite) TestSetReplacesTheIcon() {
	suite.Require().NoError(suite.teamRepo.SetIcon(suite.Ctx, suite.team.ID, "image/svg+xml", []byte("<svg/>")))
	first, err := suite.teamRepo.GetIcon(suite.Ctx, suite.team.ID)
	suite.Require().NoError(err)

	suite.Require().NoError(suite.teamRepo.SetIcon(suite.Ctx, suite.team.ID, "image/png", []byte("png")))
	second, err := suite.teamRepo.GetIcon(suite.Ctx, suite.team.ID)
	suite.Require().NoError(err)

	suite.Equal(first.ID, second.ID)
	suite.Equal("image/png", second.ContentType)
	suite.Equal([]byte("png"), second.Data)
	suite.False(second.UpdatedAt.Before(first.UpdatedAt))
	suite.Equal(1, suite.DB.TeamIcon.Query().CountX(suite.Ctx))
}

func (suite *TeamIconSuite) TestTeamQueriesCarryTheIconTimeButNotTheFile() {
	suite.Require().NoError(suite.teamRepo.SetIcon(suite.Ctx, suite.team.ID, "image/png", []byte("png")))
	icon := suite.DB.TeamIcon.Query().Where(teamicon.TeamID(suite.team.ID)).OnlyX(suite.Ctx)

	teams, err := suite.teamRepo.GetAll(suite.Ctx, nil)
	suite.Require().NoError(err)
	suite.Require().Len(teams, 1)
	suite.Require().NotNil(teams[0].Edges.Icon)
	suite.True(icon.UpdatedAt.Equal(teams[0].Edges.Icon.UpdatedAt))
	suite.Nil(teams[0].Edges.Icon.Data)

	byID, err := suite.teamRepo.GetByID(suite.Ctx, suite.team.ID)
	suite.Require().NoError(err)
	suite.Require().NotNil(byID.Edges.Icon)
	suite.Nil(byID.Edges.Icon.Data)

	renamed, err := suite.teamRepo.Update(suite.Ctx, suite.team.ID, "Acme 2", nil)
	suite.Require().NoError(err)
	suite.Equal("Acme 2", renamed.Name)
	suite.Require().NotNil(renamed.Edges.Icon)
}

func (suite *TeamIconSuite) TestDeleteAndTeamDeletionRemoveTheIcon() {
	suite.Require().NoError(suite.teamRepo.SetIcon(suite.Ctx, suite.team.ID, "image/png", []byte("png")))
	suite.Require().NoError(suite.teamRepo.DeleteIcon(suite.Ctx, suite.team.ID))
	_, err := suite.teamRepo.GetIcon(suite.Ctx, suite.team.ID)
	suite.True(ent.IsNotFound(err))

	teams, err := suite.teamRepo.GetAll(suite.Ctx, nil)
	suite.Require().NoError(err)
	suite.Nil(teams[0].Edges.Icon)

	suite.Require().NoError(suite.teamRepo.SetIcon(suite.Ctx, suite.team.ID, "image/png", []byte("png")))
	suite.Require().NoError(suite.teamRepo.Delete(suite.Ctx, nil, suite.team.ID))
	suite.Equal(0, suite.DB.TeamIcon.Query().CountX(suite.Ctx))
}

func TestTeamIconSuite(t *testing.T) {
	suite.Run(t, new(TeamIconSuite))
}
