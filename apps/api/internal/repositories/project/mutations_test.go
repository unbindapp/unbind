package project_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type ProjectMutationsSuite struct {
	repository.RepositoryBaseSuite
	projectRepo *ProjectRepository
	testTeam    *ent.Team
	testUser    *ent.User
}

func (suite *ProjectMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.projectRepo = NewProjectRepository(suite.DB)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	// Create test team (required for projects)
	suite.testTeam = suite.DB.Team.Create().
		SetName("Test Team").
		SetDescription("Test team description").
		SetKubernetesName("test-team-k8s").
		SetKubernetesSecret("test-secret").
		SetNamespace("test-namespace").
		AddMembers(suite.testUser).
		SaveX(suite.Ctx)
}

func (suite *ProjectMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.projectRepo = nil
	suite.testTeam = nil
	suite.testUser = nil
}

func (suite *ProjectMutationsSuite) TestCreate() {
	kubernetesName := "test-project-k8s"
	name := "Test Project"
	description := "Test project description"
	kubernetesSecret := "test-secret-123"

	project, err := suite.projectRepo.Create(suite.Ctx, nil, suite.testTeam.ID, kubernetesName, name, &description, kubernetesSecret)
	suite.NoError(err)
	suite.NotNil(project)
	suite.Equal(suite.testTeam.ID, project.TeamID)
	suite.Equal(kubernetesName, project.KubernetesName)
	suite.Equal(name, project.Name)
	suite.NotNil(project.Description)
	suite.Equal(description, *project.Description)
	suite.Equal(kubernetesSecret, project.KubernetesSecret)
	suite.Nil(project.DefaultEnvironmentID) // Should be nil initially
	suite.NotEqual(uuid.Nil, project.ID)

	// Verify it was saved to database
	saved, err := suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.NoError(err)
	suite.Equal(project.TeamID, saved.TeamID)
	suite.Equal(project.KubernetesName, saved.KubernetesName)
	suite.Equal(project.Name, saved.Name)
}

func (suite *ProjectMutationsSuite) TestCreateWithNilDescription() {
	kubernetesName := "test-project-nil-desc"
	name := "Test Project No Description"
	kubernetesSecret := "test-secret-nil"

	project, err := suite.projectRepo.Create(suite.Ctx, nil, suite.testTeam.ID, kubernetesName, name, nil, kubernetesSecret)
	suite.NoError(err)
	suite.NotNil(project)
	suite.Equal(suite.testTeam.ID, project.TeamID)
	suite.Equal(kubernetesName, project.KubernetesName)
	suite.Equal(name, project.Name)
	suite.Nil(project.Description)
	suite.Equal(kubernetesSecret, project.KubernetesSecret)
}

func (suite *ProjectMutationsSuite) TestCreateWithTransaction() {
	tx, err := suite.DB.Tx(suite.Ctx)
	suite.NoError(err)
	defer tx.Rollback()

	kubernetesName := "test-project-tx"
	name := "Test Project TX"
	description := "Test project with transaction"
	kubernetesSecret := "test-secret-tx"

	project, err := suite.projectRepo.Create(suite.Ctx, tx, suite.testTeam.ID, kubernetesName, name, &description, kubernetesSecret)
	suite.NoError(err)
	suite.NotNil(project)
	suite.Equal(name, project.Name)

	// Commit transaction
	err = tx.Commit()
	suite.NoError(err)

	// Verify it was saved
	saved, err := suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.NoError(err)
	suite.Equal(project.Name, saved.Name)
}

func (suite *ProjectMutationsSuite) TestCreateWithNonExistentTeam() {
	nonExistentTeamID := uuid.New()
	kubernetesName := "test-project-no-team"
	name := "Test Project No Team"
	kubernetesSecret := "test-secret"

	project, err := suite.projectRepo.Create(suite.Ctx, nil, nonExistentTeamID, kubernetesName, name, nil, kubernetesSecret)
	suite.Error(err)
	suite.Nil(project)
}

func (suite *ProjectMutationsSuite) TestCreateDBClosed() {
	suite.DB.Close()

	kubernetesName := "test-project-closed"
	name := "Test Project Closed"
	kubernetesSecret := "test-secret"

	project, err := suite.projectRepo.Create(suite.Ctx, nil, suite.testTeam.ID, kubernetesName, name, nil, kubernetesSecret)
	suite.Error(err)
	suite.Nil(project)
	suite.ErrorContains(err, "database is closed")
}

func (suite *ProjectMutationsSuite) TestUpdate() {
	// Create a project first
	originalDescription := "Original description"
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("update-test-k8s").
		SetName("Original Name").
		SetDescription(originalDescription).
		SetKubernetesSecret("original-secret").
		SaveX(suite.Ctx)

	// Update with new values
	newName := "Updated Name"
	newDescription := "Updated description"

	updated, err := suite.projectRepo.Update(suite.Ctx, nil, project.ID, nil, newName, &newDescription)
	suite.NoError(err)
	suite.NotNil(updated)
	suite.Equal(project.ID, updated.ID)
	suite.Equal(newName, updated.Name)
	suite.NotNil(updated.Description)
	suite.Equal(newDescription, *updated.Description)
	suite.Equal(project.KubernetesName, updated.KubernetesName)     // Should remain unchanged
	suite.Equal(project.KubernetesSecret, updated.KubernetesSecret) // Should remain unchanged
}

func (suite *ProjectMutationsSuite) TestUpdateNameOnly() {
	// Create a project first
	originalDescription := "Keep this description"
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("update-name-k8s").
		SetName("Original Name").
		SetDescription(originalDescription).
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	// Update only the name
	newName := "Only Name Updated"

	updated, err := suite.projectRepo.Update(suite.Ctx, nil, project.ID, nil, newName, nil)
	suite.NoError(err)
	suite.NotNil(updated)
	suite.Equal(newName, updated.Name)
	suite.NotNil(updated.Description)
	suite.Equal(originalDescription, *updated.Description) // Should remain unchanged
}

func (suite *ProjectMutationsSuite) TestUpdateClearDescription() {
	// Create a project with description
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("clear-desc-k8s").
		SetName("Clear Description Test").
		SetDescription("Description to be cleared").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	// Update with empty description to clear it
	emptyDescription := ""

	updated, err := suite.projectRepo.Update(suite.Ctx, nil, project.ID, nil, "", &emptyDescription)
	suite.NoError(err)
	suite.NotNil(updated)
	suite.Nil(updated.Description) // Should be cleared
}

func (suite *ProjectMutationsSuite) TestUpdateWithDefaultEnvironment() {
	// Create a project first
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("env-test-k8s").
		SetName("Environment Test Project").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	// Create an environment belonging to this project
	environment := suite.DB.Environment.Create().
		SetProjectID(project.ID).
		SetName("Test Environment").
		SetKubernetesName("test-env-k8s").
		SetKubernetesSecret("env-secret").
		SaveX(suite.Ctx)

	// Update project to set default environment
	updated, err := suite.projectRepo.Update(suite.Ctx, nil, project.ID, &environment.ID, "", nil)
	suite.NoError(err)
	suite.NotNil(updated)
	suite.NotNil(updated.DefaultEnvironmentID)
	suite.Equal(environment.ID, *updated.DefaultEnvironmentID)
}

func (suite *ProjectMutationsSuite) TestUpdateWithInvalidDefaultEnvironment() {
	// Create a project
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("invalid-env-k8s").
		SetName("Invalid Environment Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	// Create another project and environment
	anotherTeam := suite.DB.Team.Create().
		SetName("Another Team").
		SetKubernetesName("another-team-k8s").
		SetKubernetesSecret("another-secret").
		SetNamespace("another-namespace").
		SaveX(suite.Ctx)

	anotherProject := suite.DB.Project.Create().
		SetTeamID(anotherTeam.ID).
		SetKubernetesName("another-project-k8s").
		SetName("Another Project").
		SetKubernetesSecret("another-secret").
		SaveX(suite.Ctx)

	wrongEnvironment := suite.DB.Environment.Create().
		SetProjectID(anotherProject.ID).
		SetName("Wrong Environment").
		SetKubernetesName("wrong-env-k8s").
		SetKubernetesSecret("wrong-secret").
		SaveX(suite.Ctx)

	// Try to set environment from different project as default
	updated, err := suite.projectRepo.Update(suite.Ctx, nil, project.ID, &wrongEnvironment.ID, "", nil)
	suite.Error(err)
	suite.Nil(updated)
}

func (suite *ProjectMutationsSuite) TestUpdateWithNonExistentEnvironment() {
	// Create a project
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("nonexist-env-k8s").
		SetName("Non-existent Environment Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	// Try to set non-existent environment as default
	nonExistentEnvID := uuid.New()
	updated, err := suite.projectRepo.Update(suite.Ctx, nil, project.ID, &nonExistentEnvID, "", nil)
	suite.Error(err)
	suite.Nil(updated)
}

func (suite *ProjectMutationsSuite) TestUpdateWithTransaction() {
	// Create a project first
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("tx-update-k8s").
		SetName("Transaction Update Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	tx, err := suite.DB.Tx(suite.Ctx)
	suite.NoError(err)
	defer tx.Rollback()

	newName := "Updated via Transaction"
	newDescription := "Updated description via transaction"

	updated, err := suite.projectRepo.Update(suite.Ctx, tx, project.ID, nil, newName, &newDescription)
	suite.NoError(err)
	suite.Equal(newName, updated.Name)

	err = tx.Commit()
	suite.NoError(err)

	// Verify changes were committed
	saved, err := suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.NoError(err)
	suite.Equal(newName, saved.Name)
}

func (suite *ProjectMutationsSuite) TestUpdateNonExistentProject() {
	nonExistentProjectID := uuid.New()
	newName := "Non-existent Project"

	updated, err := suite.projectRepo.Update(suite.Ctx, nil, nonExistentProjectID, nil, newName, nil)
	suite.Error(err)
	suite.Nil(updated)
}

func (suite *ProjectMutationsSuite) TestUpdateDBClosed() {
	// Create a project first
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("closed-update-k8s").
		SetName("DB Closed Update Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	suite.DB.Close()

	newName := "Updated Name"
	updated, err := suite.projectRepo.Update(suite.Ctx, nil, project.ID, nil, newName, nil)
	suite.Error(err)
	suite.Nil(updated)
	suite.ErrorContains(err, "database is closed")
}

func (suite *ProjectMutationsSuite) TestClearDefaultEnvironment() {
	// Create a project
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("clear-default-k8s").
		SetName("Clear Default Environment Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	// Create and set default environment
	environment := suite.DB.Environment.Create().
		SetProjectID(project.ID).
		SetName("Default Environment").
		SetKubernetesName("default-env-k8s").
		SetKubernetesSecret("env-secret").
		SaveX(suite.Ctx)

	suite.DB.Project.UpdateOneID(project.ID).
		SetDefaultEnvironmentID(environment.ID).
		SaveX(suite.Ctx)

	// Verify default environment is set
	updated, err := suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.NoError(err)
	suite.NotNil(updated.DefaultEnvironmentID)

	// Clear default environment
	err = suite.projectRepo.ClearDefaultEnvironment(suite.Ctx, nil, project.ID)
	suite.NoError(err)

	// Verify default environment is cleared
	cleared, err := suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.NoError(err)
	suite.Nil(cleared.DefaultEnvironmentID)
}

func (suite *ProjectMutationsSuite) TestClearDefaultEnvironmentWithTransaction() {
	// Create a project with default environment
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("clear-tx-k8s").
		SetName("Clear TX Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	environment := suite.DB.Environment.Create().
		SetProjectID(project.ID).
		SetName("TX Environment").
		SetKubernetesName("tx-env-k8s").
		SetKubernetesSecret("env-secret").
		SaveX(suite.Ctx)

	suite.DB.Project.UpdateOneID(project.ID).
		SetDefaultEnvironmentID(environment.ID).
		SaveX(suite.Ctx)

	tx, err := suite.DB.Tx(suite.Ctx)
	suite.NoError(err)
	defer tx.Rollback()

	err = suite.projectRepo.ClearDefaultEnvironment(suite.Ctx, tx, project.ID)
	suite.NoError(err)

	err = tx.Commit()
	suite.NoError(err)

	// Verify cleared
	cleared, err := suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.NoError(err)
	suite.Nil(cleared.DefaultEnvironmentID)
}

func (suite *ProjectMutationsSuite) TestClearDefaultEnvironmentNonExistentProject() {
	nonExistentProjectID := uuid.New()

	err := suite.projectRepo.ClearDefaultEnvironment(suite.Ctx, nil, nonExistentProjectID)
	suite.Error(err)
}

func (suite *ProjectMutationsSuite) TestClearDefaultEnvironmentDBClosed() {
	// Create a project first
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("closed-clear-k8s").
		SetName("DB Closed Clear Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	suite.DB.Close()

	err := suite.projectRepo.ClearDefaultEnvironment(suite.Ctx, nil, project.ID)
	suite.Error(err)
	suite.ErrorContains(err, "database is closed")
}

func (suite *ProjectMutationsSuite) TestDelete() {
	// Create a project to delete
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("delete-test-k8s").
		SetName("Delete Test Project").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	// Verify it exists
	_, err := suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.NoError(err)

	// Delete it
	err = suite.projectRepo.Delete(suite.Ctx, nil, project.ID)
	suite.NoError(err)

	// Verify it's gone
	_, err = suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.Error(err)
}

func (suite *ProjectMutationsSuite) TestDeleteWithTransaction() {
	// Create a project
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("delete-tx-k8s").
		SetName("Delete TX Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	tx, err := suite.DB.Tx(suite.Ctx)
	suite.NoError(err)
	defer tx.Rollback()

	err = suite.projectRepo.Delete(suite.Ctx, tx, project.ID)
	suite.NoError(err)

	err = tx.Commit()
	suite.NoError(err)

	// Verify deleted
	_, err = suite.DB.Project.Get(suite.Ctx, project.ID)
	suite.Error(err)
}

func (suite *ProjectMutationsSuite) TestDeleteNonExistentProject() {
	nonExistentProjectID := uuid.New()

	// Should not error when deleting non-existent project
	err := suite.projectRepo.Delete(suite.Ctx, nil, nonExistentProjectID)
	suite.Error(err)
	suite.True(ent.IsNotFound(err))
}

func (suite *ProjectMutationsSuite) TestDeleteDBClosed() {
	// Create a project first
	project := suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("closed-delete-k8s").
		SetName("DB Closed Delete Test").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	suite.DB.Close()

	err := suite.projectRepo.Delete(suite.Ctx, nil, project.ID)
	suite.Error(err)
	suite.ErrorContains(err, "database is closed")
}

func TestProjectMutationsSuite(t *testing.T) {
	suite.Run(t, new(ProjectMutationsSuite))
}
