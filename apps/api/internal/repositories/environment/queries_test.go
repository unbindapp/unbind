package environment_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type EnvironmentQueriesSuite struct {
	repository.RepositoryBaseSuite
	environmentRepo *EnvironmentRepository
	testTeam        *ent.Team
	testProject     *ent.Project
	testEnvironment *ent.Environment
}

func (suite *EnvironmentQueriesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.environmentRepo = NewEnvironmentRepository(suite.DB)

	// Create test data hierarchy
	suite.testTeam = suite.DB.Team.Create().
		SetKubernetesName("test-team").
		SetName("Test Team").
		SetNamespace("test-team").
		SetKubernetesSecret("test-team-secret").
		SaveX(suite.Ctx)

	suite.testProject = suite.DB.Project.Create().
		SetName("test-project").
		SetKubernetesName("test-project-k8s").
		SetKubernetesSecret("test-secret").
		SetTeamID(suite.testTeam.ID).
		SaveX(suite.Ctx)

	suite.testEnvironment = suite.DB.Environment.Create().
		SetKubernetesName("test-env").
		SetName("Test Environment").
		SetProjectID(suite.testProject.ID).
		SetKubernetesSecret("test-env-secret").
		SaveX(suite.Ctx)
}

func (suite *EnvironmentQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.environmentRepo = nil
	suite.testTeam = nil
	suite.testProject = nil
	suite.testEnvironment = nil
}

func (suite *EnvironmentQueriesSuite) TestGetByID() {
	suite.Run("GetByID Success", func() {
		environment, err := suite.environmentRepo.GetByID(suite.Ctx, suite.testEnvironment.ID)
		suite.NoError(err)
		suite.NotNil(environment)
		suite.Equal(suite.testEnvironment.ID, environment.ID)
		suite.Equal("Test Environment", environment.Name)
		suite.Equal("test-env", environment.KubernetesName)
		suite.NotNil(environment.Edges.Project)
		suite.NotNil(environment.Edges.Project.Edges.Team)
	})

	suite.Run("GetByID Not Found", func() {
		nonExistentID := uuid.New()
		environment, err := suite.environmentRepo.GetByID(suite.Ctx, nonExistentID)
		suite.Error(err)
		suite.Zero(environment)
	})

	suite.Run("GetByID Error when DB closed", func() {
		suite.DB.Close()
		environment, err := suite.environmentRepo.GetByID(suite.Ctx, suite.testEnvironment.ID)
		suite.Error(err)
		suite.Zero(environment)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *EnvironmentQueriesSuite) TestGetForProject() {
	suite.Run("GetForProject Success", func() {
		environments, err := suite.environmentRepo.GetForProject(suite.Ctx, nil, suite.testProject.ID, nil)
		suite.NoError(err)
		suite.Len(environments, 1)
		suite.Equal(suite.testEnvironment.ID, environments[0].ID)
		suite.NotNil(environments[0].Edges.Services)
		suite.Len(environments[0].Edges.Services, 0) // No services created
	})

	suite.Run("GetForProject Multiple Environments", func() {
		// Create additional environments for the same project
		suite.DB.Environment.Create().
			SetKubernetesName("test-env-2").
			SetName("Test Environment 2").
			SetProjectID(suite.testProject.ID).
			SetKubernetesSecret("test-env-2-secret").
			SaveX(suite.Ctx)

		suite.DB.Environment.Create().
			SetKubernetesName("test-env-3").
			SetName("Test Environment 3").
			SetProjectID(suite.testProject.ID).
			SetKubernetesSecret("test-env-3-secret").
			SaveX(suite.Ctx)

		environments, err := suite.environmentRepo.GetForProject(suite.Ctx, nil, suite.testProject.ID, nil)
		suite.NoError(err)
		suite.Len(environments, 3)

		// Should be ordered by created_at ASC
		suite.True(environments[0].CreatedAt.Before(environments[1].CreatedAt))
		suite.True(environments[1].CreatedAt.Before(environments[2].CreatedAt))

		// Verify all environments belong to the project
		for _, env := range environments {
			suite.Equal(suite.testProject.ID, env.ProjectID)
		}
	})

	suite.Run("GetForProject Empty Result", func() {
		// Create another project with no environments
		anotherProject := suite.DB.Project.Create().
			SetName("empty-project").
			SetKubernetesName("empty-project-k8s").
			SetKubernetesSecret("empty-secret").
			SetTeamID(suite.testTeam.ID).
			SaveX(suite.Ctx)

		environments, err := suite.environmentRepo.GetForProject(suite.Ctx, nil, anotherProject.ID, nil)
		suite.NoError(err)
		suite.Len(environments, 0)
	})

	suite.Run("GetForProject Error when DB closed", func() {
		suite.DB.Close()
		environments, err := suite.environmentRepo.GetForProject(suite.Ctx, nil, suite.testProject.ID, nil)
		suite.Error(err)
		suite.Nil(environments)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestEnvironmentQueriesSuite(t *testing.T) {
	suite.Run(t, new(EnvironmentQueriesSuite))
}
