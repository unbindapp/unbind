package team_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type TeamMutationsSuite struct {
	repository.RepositoryBaseSuite
	teamRepo *TeamRepository
	testUser *ent.User
	testTeam *ent.Team
}

func (suite *TeamMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.teamRepo = NewTeamRepository(suite.DB)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	// Create test team
	suite.testTeam = suite.DB.Team.Create().
		SetKubernetesName("test-team").
		SetName("Test Team").
		SetDescription("Test team description").
		SetNamespace("test-namespace").
		SetKubernetesSecret("test-k8s-secret").
		SaveX(suite.Ctx)
}

func (suite *TeamMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.teamRepo = nil
	suite.testUser = nil
	suite.testTeam = nil
}

func (suite *TeamMutationsSuite) TestUpdate() {
	suite.Run("Update Name and Description", func() {
		team, err := suite.teamRepo.Update(
			suite.Ctx,
			suite.testTeam.ID,
			"Updated Team Name",
			utils.ToPtr("Updated description"),
		)

		suite.NoError(err)
		suite.NotNil(team)
		suite.Equal("Updated Team Name", team.Name)
		suite.NotNil(team.Description)
		suite.Equal("Updated description", *team.Description)
	})

	suite.Run("Update Name Only", func() {
		team, err := suite.teamRepo.Update(
			suite.Ctx,
			suite.testTeam.ID,
			"Name Only Update",
			nil,
		)

		suite.NoError(err)
		suite.Equal("Name Only Update", team.Name)
	})

	suite.Run("Clear Description", func() {
		team, err := suite.teamRepo.Update(
			suite.Ctx,
			suite.testTeam.ID,
			"",
			utils.ToPtr(""),
		)

		suite.NoError(err)
		suite.Nil(team.Description)
	})

	suite.Run("Non-existent Team", func() {
		_, err := suite.teamRepo.Update(
			suite.Ctx,
			uuid.New(),
			"Non-existent",
			nil,
		)

		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.teamRepo.Update(
			suite.Ctx,
			suite.testTeam.ID,
			"Closed DB",
			nil,
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestTeamMutationsSuite(t *testing.T) {
	suite.Run(t, new(TeamMutationsSuite))
}
