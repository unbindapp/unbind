package team_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/team"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type TeamQueriesSuite struct {
	repository.RepositoryBaseSuite
	teamRepo *TeamRepository
	testUser *ent.User
	testTeam *ent.Team
}

func (suite *TeamQueriesSuite) SetupTest() {
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

func (suite *TeamQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.teamRepo = nil
	suite.testUser = nil
	suite.testTeam = nil
}

func (suite *TeamQueriesSuite) TestGetAll() {
	suite.Run("Get All Teams", func() {
		teams, err := suite.teamRepo.GetAll(suite.Ctx, nil)
		suite.NoError(err)
		suite.GreaterOrEqual(len(teams), 1)
	})

	suite.Run("Get All With Predicate", func() {
		teams, err := suite.teamRepo.GetAll(suite.Ctx, team.NameEQ("Test Team"))
		suite.NoError(err)
		suite.Len(teams, 1)
		suite.Equal("Test Team", teams[0].Name)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.teamRepo.GetAll(suite.Ctx, nil)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *TeamQueriesSuite) TestGetByID() {
	suite.Run("Get By ID Success", func() {
		team, err := suite.teamRepo.GetByID(suite.Ctx, suite.testTeam.ID)
		suite.NoError(err)
		suite.NotNil(team)
		suite.Equal(suite.testTeam.ID, team.ID)
		suite.Equal("Test Team", team.Name)
		suite.NotNil(team.Edges.Projects)
	})

	suite.Run("Get Non-existent Team", func() {
		_, err := suite.teamRepo.GetByID(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.teamRepo.GetByID(suite.Ctx, suite.testTeam.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *TeamQueriesSuite) TestGetNamespace() {
	suite.Run("Get Namespace Success", func() {
		namespace, err := suite.teamRepo.GetNamespace(suite.Ctx, suite.testTeam.ID)
		suite.NoError(err)
		suite.Equal("test-namespace", namespace)
	})

	suite.Run("Get Non-existent Team", func() {
		_, err := suite.teamRepo.GetNamespace(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.teamRepo.GetNamespace(suite.Ctx, suite.testTeam.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *TeamQueriesSuite) TestHasUserWithID() {
	suite.Run("User Has Access", func() {
		// Add user to team
		suite.DB.Team.UpdateOneID(suite.testTeam.ID).
			AddMemberIDs(suite.testUser.ID).
			SaveX(suite.Ctx)

		hasAccess, err := suite.teamRepo.HasUserWithID(suite.Ctx, suite.testTeam.ID, suite.testUser.ID)
		suite.NoError(err)
		suite.True(hasAccess)
	})

	suite.Run("User No Access", func() {
		// Create another user
		pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
		otherUser := suite.DB.User.Create().
			SetEmail("other@example.com").
			SetPasswordHash(string(pwd)).
			SaveX(suite.Ctx)

		hasAccess, err := suite.teamRepo.HasUserWithID(suite.Ctx, suite.testTeam.ID, otherUser.ID)
		suite.NoError(err)
		suite.False(hasAccess)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.teamRepo.HasUserWithID(suite.Ctx, suite.testTeam.ID, suite.testUser.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestTeamQueriesSuite(t *testing.T) {
	suite.Run(t, new(TeamQueriesSuite))
}
