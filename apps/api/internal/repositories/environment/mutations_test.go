package environment_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type EnvironmentMutationsSuite struct {
	repository.RepositoryBaseSuite
	environmentRepo *EnvironmentRepository
	testTeam        *ent.Team
	testProject     *ent.Project
}

func (suite *EnvironmentMutationsSuite) SetupTest() {
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
}

func (suite *EnvironmentMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.environmentRepo = nil
	suite.testTeam = nil
	suite.testProject = nil
}

func (suite *EnvironmentMutationsSuite) TestCreate() {
	suite.Run("Create Success", func() {
		description := "Test environment description"
		environment, err := suite.environmentRepo.Create(
			suite.Ctx,
			nil,
			"test-env-k8s",
			"Test Environment",
			"test-env-secret",
			&description,
			suite.testProject.ID,
		)
		suite.NoError(err)
		suite.NotNil(environment)
		suite.Equal("test-env-k8s", environment.KubernetesName)
		suite.Equal("Test Environment", environment.Name)
		suite.Equal("test-env-secret", environment.KubernetesSecret)
		suite.NotNil(environment.Description)
		suite.Equal(description, *environment.Description)
		suite.Equal(suite.testProject.ID, environment.ProjectID)
		suite.NotZero(environment.ID)
		suite.NotZero(environment.CreatedAt)
		suite.NotZero(environment.UpdatedAt)
	})

	suite.Run("Create Success Without Description", func() {
		environment, err := suite.environmentRepo.Create(
			suite.Ctx,
			nil,
			"test-env-no-desc",
			"Test Environment No Desc",
			"test-env-no-desc-secret",
			nil,
			suite.testProject.ID,
		)
		suite.NoError(err)
		suite.NotNil(environment)
		suite.Equal("test-env-no-desc", environment.KubernetesName)
		suite.Equal("Test Environment No Desc", environment.Name)
		suite.Nil(environment.Description)
	})

	suite.Run("Create With Transaction", func() {
		tx, err := suite.DB.Tx(suite.Ctx)
		suite.NoError(err)
		defer tx.Rollback()

		environment, err := suite.environmentRepo.Create(
			suite.Ctx,
			tx,
			"test-env-tx",
			"Test Environment TX",
			"test-env-tx-secret",
			nil,
			suite.testProject.ID,
		)
		suite.NoError(err)
		suite.NotNil(environment)

		err = tx.Commit()
		suite.NoError(err)

		// Verify it was committed
		found, err := suite.DB.Environment.Get(suite.Ctx, environment.ID)
		suite.NoError(err)
		suite.Equal("test-env-tx", found.KubernetesName)
	})

	suite.Run("Create Error - Duplicate Kubernetes Name", func() {
		// First environment
		_, err := suite.environmentRepo.Create(
			suite.Ctx,
			nil,
			"duplicate-name",
			"First Environment",
			"first-secret",
			nil,
			suite.testProject.ID,
		)
		suite.NoError(err)

		// Second environment with same kubernetes name
		environment, err := suite.environmentRepo.Create(
			suite.Ctx,
			nil,
			"duplicate-name",
			"Second Environment",
			"second-secret",
			nil,
			suite.testProject.ID,
		)
		suite.Error(err)
		suite.Nil(environment)
	})

	suite.Run("Create Error - Invalid Project ID", func() {
		nonExistentProjectID := uuid.New()
		environment, err := suite.environmentRepo.Create(
			suite.Ctx,
			nil,
			"invalid-project-env",
			"Invalid Project Environment",
			"invalid-project-secret",
			nil,
			nonExistentProjectID,
		)
		suite.Error(err)
		suite.Nil(environment)
	})

	suite.Run("Create Error when DB closed", func() {
		suite.DB.Close()
		environment, err := suite.environmentRepo.Create(
			suite.Ctx,
			nil,
			"closed-db-env",
			"Closed DB Environment",
			"closed-db-secret",
			nil,
			suite.testProject.ID,
		)
		suite.Error(err)
		suite.Nil(environment)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *EnvironmentMutationsSuite) TestDelete() {
	suite.Run("Delete Success", func() {
		// Create environment to delete
		environment := suite.DB.Environment.Create().
			SetKubernetesName("to-delete").
			SetName("To Delete").
			SetKubernetesSecret("to-delete-secret").
			SetProjectID(suite.testProject.ID).
			SaveX(suite.Ctx)

		err := suite.environmentRepo.Delete(suite.Ctx, nil, environment.ID)
		suite.NoError(err)

		// Verify it was deleted
		found, err := suite.DB.Environment.Get(suite.Ctx, environment.ID)
		suite.Error(err)
		suite.Nil(found)
	})

	suite.Run("Delete With Transaction", func() {
		// Create environment to delete
		environment := suite.DB.Environment.Create().
			SetKubernetesName("to-delete-tx").
			SetName("To Delete TX").
			SetKubernetesSecret("to-delete-tx-secret").
			SetProjectID(suite.testProject.ID).
			SaveX(suite.Ctx)

		tx, err := suite.DB.Tx(suite.Ctx)
		suite.NoError(err)
		defer tx.Rollback()

		err = suite.environmentRepo.Delete(suite.Ctx, tx, environment.ID)
		suite.NoError(err)

		err = tx.Commit()
		suite.NoError(err)

		// Verify it was deleted
		found, err := suite.DB.Environment.Get(suite.Ctx, environment.ID)
		suite.Error(err)
		suite.Nil(found)
	})

	suite.Run("Delete Non-existent Environment", func() {
		nonExistentID := uuid.New()
		err := suite.environmentRepo.Delete(suite.Ctx, nil, nonExistentID)
		suite.Error(err)
	})

	suite.Run("Delete Error when DB closed", func() {
		environment := suite.DB.Environment.Create().
			SetKubernetesName("closed-delete").
			SetName("Closed Delete").
			SetKubernetesSecret("closed-delete-secret").
			SetProjectID(suite.testProject.ID).
			SaveX(suite.Ctx)

		suite.DB.Close()
		err := suite.environmentRepo.Delete(suite.Ctx, nil, environment.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *EnvironmentMutationsSuite) TestUpdate() {
	var testEnvironment *ent.Environment

	suite.Run("Setup Environment for Updates", func() {
		description := "Original description"
		testEnvironment = suite.DB.Environment.Create().
			SetKubernetesName("update-test").
			SetName("Original Name").
			SetDescription(description).
			SetKubernetesSecret("update-test-secret").
			SetProjectID(suite.testProject.ID).
			SaveX(suite.Ctx)
	})

	suite.Run("Update Success - Name Only", func() {
		newName := "Updated Name"
		updated, err := suite.environmentRepo.Update(
			suite.Ctx,
			testEnvironment.ID,
			&newName,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(updated)
		suite.Equal(newName, updated.Name)
		suite.Equal("Original description", *updated.Description) // Unchanged
		suite.Equal(testEnvironment.ID, updated.ID)
	})

	suite.Run("Update Success - Description Only", func() {
		newDescription := "Updated description"
		updated, err := suite.environmentRepo.Update(
			suite.Ctx,
			testEnvironment.ID,
			nil,
			&newDescription,
		)
		suite.NoError(err)
		suite.NotNil(updated)
		suite.Equal("Updated Name", updated.Name) // From previous test
		suite.Equal(newDescription, *updated.Description)
	})

	suite.Run("Update Success - Both Name and Description", func() {
		newName := "Fully Updated Name"
		newDescription := "Fully updated description"
		updated, err := suite.environmentRepo.Update(
			suite.Ctx,
			testEnvironment.ID,
			&newName,
			&newDescription,
		)
		suite.NoError(err)
		suite.NotNil(updated)
		suite.Equal(newName, updated.Name)
		suite.Equal(newDescription, *updated.Description)
	})

	suite.Run("Update Success - Clear Description", func() {
		newName := "Name with No Description"
		updated, err := suite.environmentRepo.Update(
			suite.Ctx,
			testEnvironment.ID,
			&newName,
			utils.ToPtr(""),
		)
		suite.NoError(err)
		suite.NotNil(updated)
		suite.Equal(newName, updated.Name)
		suite.NotNil(updated.Description)
		suite.Equal("", *updated.Description)
	})

	suite.Run("Update Success - No Changes", func() {
		// Get current state
		current, err := suite.DB.Environment.Get(suite.Ctx, testEnvironment.ID)
		suite.NoError(err)

		updated, err := suite.environmentRepo.Update(
			suite.Ctx,
			testEnvironment.ID,
			nil,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(updated)
		suite.Equal(current.Name, updated.Name)
		suite.Equal(*current.Description, *updated.Description)
	})

	suite.Run("Update Error - Non-existent Environment", func() {
		nonExistentID := uuid.New()
		newName := "Non-existent"
		updated, err := suite.environmentRepo.Update(
			suite.Ctx,
			nonExistentID,
			&newName,
			nil,
		)
		suite.Error(err)
		suite.Nil(updated)
	})

	suite.Run("Update Error when DB closed", func() {
		suite.DB.Close()
		newName := "Closed DB Name"
		updated, err := suite.environmentRepo.Update(
			suite.Ctx,
			testEnvironment.ID,
			&newName,
			nil,
		)
		suite.Error(err)
		suite.Nil(updated)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestEnvironmentMutationsSuite(t *testing.T) {
	suite.Run(t, new(EnvironmentMutationsSuite))
}
