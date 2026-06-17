package project_repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/project"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type ProjectQueriesSuite struct {
	repository.RepositoryBaseSuite
	projectRepo  *ProjectRepository
	testTeam     *ent.Team
	testTeam2    *ent.Team
	testUser     *ent.User
	testProject  *ent.Project
	testProject2 *ent.Project
	testProject3 *ent.Project
}

func (suite *ProjectQueriesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.projectRepo = NewProjectRepository(suite.DB)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	// Create test teams
	suite.testTeam = suite.DB.Team.Create().
		SetName("Test Team").
		SetDescription("Test team description").
		SetKubernetesName("test-team-k8s").
		SetKubernetesSecret("test-secret").
		SetNamespace("test-namespace").
		AddMembers(suite.testUser).
		SaveX(suite.Ctx)

	suite.testTeam2 = suite.DB.Team.Create().
		SetName("Test Team 2").
		SetDescription("Second test team").
		SetKubernetesName("test-team-2-k8s").
		SetKubernetesSecret("test-secret2").
		SetNamespace("test-namespace2").
		SaveX(suite.Ctx)

	// Create test projects with different timestamps
	now := time.Now()

	suite.testProject = suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("test-project-1-k8s").
		SetName("Test Project 1").
		SetDescription("First test project").
		SetKubernetesSecret("secret-1").
		SetCreatedAt(now.Add(-2 * time.Hour)).
		SetUpdatedAt(now.Add(-1 * time.Hour)).
		SaveX(suite.Ctx)

	suite.testProject2 = suite.DB.Project.Create().
		SetTeamID(suite.testTeam.ID).
		SetKubernetesName("test-project-2-k8s").
		SetName("Test Project 2").
		SetDescription("Second test project").
		SetKubernetesSecret("secret-2").
		SetCreatedAt(now.Add(-1 * time.Hour)).
		SetUpdatedAt(now).
		SaveX(suite.Ctx)

	suite.testProject3 = suite.DB.Project.Create().
		SetTeamID(suite.testTeam2.ID).
		SetKubernetesName("test-project-3-k8s").
		SetName("Test Project 3").
		SetDescription("Third test project in different team").
		SetKubernetesSecret("secret-3").
		SetCreatedAt(now).
		SetUpdatedAt(now.Add(-30 * time.Minute)).
		SaveX(suite.Ctx)

	// Create test environments for projects
	suite.DB.Environment.Create().
		SetProjectID(suite.testProject.ID).
		SetName("Dev Environment").
		SetKubernetesName("dev-env-k8s").
		SetKubernetesSecret("dev-secret").
		SetCreatedAt(now.Add(-1 * time.Hour)).
		SaveX(suite.Ctx)

	suite.DB.Environment.Create().
		SetProjectID(suite.testProject.ID).
		SetName("Prod Environment").
		SetKubernetesName("prod-env-k8s").
		SetKubernetesSecret("prod-secret").
		SetCreatedAt(now.Add(-30 * time.Minute)).
		SaveX(suite.Ctx)

	suite.DB.Environment.Create().
		SetProjectID(suite.testProject2.ID).
		SetName("Test Environment").
		SetKubernetesName("test-env-k8s").
		SetKubernetesSecret("test-secret").
		SetCreatedAt(now).
		SaveX(suite.Ctx)
}

func (suite *ProjectQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.projectRepo = nil
	suite.testTeam = nil
	suite.testTeam2 = nil
	suite.testUser = nil
	suite.testProject = nil
	suite.testProject2 = nil
	suite.testProject3 = nil
}

func (suite *ProjectQueriesSuite) TestGetByID() {
	project, err := suite.projectRepo.GetByID(suite.Ctx, suite.testProject.ID)
	suite.NoError(err)
	suite.NotNil(project)
	suite.Equal(suite.testProject.ID, project.ID)
	suite.Equal("Test Project 1", project.Name)
	suite.Equal("First test project", *project.Description)
	suite.Equal("test-project-1-k8s", project.KubernetesName)
	suite.Equal("secret-1", project.KubernetesSecret)
	suite.Equal(suite.testTeam.ID, project.TeamID)

	// Team edge should be loaded
	suite.NotNil(project.Edges.Team)
	suite.Equal(suite.testTeam.ID, project.Edges.Team.ID)
	suite.Equal("Test Team", project.Edges.Team.Name)

	// Environments edge should be loaded and ordered by created_at
	suite.NotNil(project.Edges.Environments)
	suite.Len(project.Edges.Environments, 2)
	suite.Equal("Dev Environment", project.Edges.Environments[0].Name)  // Created first
	suite.Equal("Prod Environment", project.Edges.Environments[1].Name) // Created second
}

func (suite *ProjectQueriesSuite) TestGetByIDWithNoEnvironments() {
	project, err := suite.projectRepo.GetByID(suite.Ctx, suite.testProject3.ID)
	suite.NoError(err)
	suite.NotNil(project)
	suite.Equal(suite.testProject3.ID, project.ID)
	suite.Equal("Test Project 3", project.Name)

	// Team edge should be loaded
	suite.NotNil(project.Edges.Team)
	suite.Equal(suite.testTeam2.ID, project.Edges.Team.ID)

	// Environments edge should be loaded but empty
	suite.NotNil(project.Edges.Environments)
	suite.Len(project.Edges.Environments, 0)
}

func (suite *ProjectQueriesSuite) TestGetByIDNotFound() {
	nonExistentID := uuid.New()
	project, err := suite.projectRepo.GetByID(suite.Ctx, nonExistentID)
	suite.Error(err)
	suite.Nil(project)
}

func (suite *ProjectQueriesSuite) TestGetByIDDBClosed() {
	suite.DB.Close()
	project, err := suite.projectRepo.GetByID(suite.Ctx, suite.testProject.ID)
	suite.Error(err)
	suite.Nil(project)
	suite.ErrorContains(err, "database is closed")
}

func (suite *ProjectQueriesSuite) TestGetTeamID() {
	teamID, err := suite.projectRepo.GetTeamID(suite.Ctx, suite.testProject.ID)
	suite.NoError(err)
	suite.Equal(suite.testTeam.ID, teamID)
}

func (suite *ProjectQueriesSuite) TestGetTeamIDDifferentProject() {
	teamID, err := suite.projectRepo.GetTeamID(suite.Ctx, suite.testProject3.ID)
	suite.NoError(err)
	suite.Equal(suite.testTeam2.ID, teamID)
}

func (suite *ProjectQueriesSuite) TestGetTeamIDNotFound() {
	nonExistentID := uuid.New()
	teamID, err := suite.projectRepo.GetTeamID(suite.Ctx, nonExistentID)
	suite.Error(err)
	suite.Equal(uuid.Nil, teamID)
}

func (suite *ProjectQueriesSuite) TestGetTeamIDDBClosed() {
	suite.DB.Close()
	teamID, err := suite.projectRepo.GetTeamID(suite.Ctx, suite.testProject.ID)
	suite.Error(err)
	suite.Equal(uuid.Nil, teamID)
	suite.ErrorContains(err, "database is closed")
}

func (suite *ProjectQueriesSuite) TestGetByTeamBasic() {
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, nil, "", "")
	suite.NoError(err)
	suite.Len(projects, 2)

	// Should be ordered by created_at ascending by default
	suite.Equal(suite.testProject.ID, projects[0].ID)  // Created first
	suite.Equal(suite.testProject2.ID, projects[1].ID) // Created second

	// Verify environments are loaded for each project
	suite.NotNil(projects[0].Edges.Environments)
	suite.Len(projects[0].Edges.Environments, 2)
	suite.NotNil(projects[1].Edges.Environments)
	suite.Len(projects[1].Edges.Environments, 1)
}

func (suite *ProjectQueriesSuite) TestGetByTeamDifferentTeam() {
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam2.ID, nil, "", "")
	suite.NoError(err)
	suite.Len(projects, 1)
	suite.Equal(suite.testProject3.ID, projects[0].ID)
	suite.Equal("Test Project 3", projects[0].Name)
}

func (suite *ProjectQueriesSuite) TestGetByTeamNoProjects() {
	// Create a team with no projects
	emptyTeam := suite.DB.Team.Create().
		SetName("Empty Team").
		SetKubernetesName("empty-team-k8s").
		SetKubernetesSecret("empty-secret").
		SetNamespace("empty-namespace").
		SaveX(suite.Ctx)

	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, emptyTeam.ID, nil, "", "")
	suite.NoError(err)
	suite.Len(projects, 0)
}

func (suite *ProjectQueriesSuite) TestGetByTeamWithAuthPredicate() {
	// Create predicate that only matches projects with specific name
	authPredicate := project.NameContains("Project 1")

	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, authPredicate, "", "")
	suite.NoError(err)
	suite.Len(projects, 1)
	suite.Equal(suite.testProject.ID, projects[0].ID)
	suite.Equal("Test Project 1", projects[0].Name)
}

func (suite *ProjectQueriesSuite) TestGetByTeamWithAuthPredicateNoMatches() {
	// Create predicate that matches no projects
	authPredicate := project.NameContains("Nonexistent")

	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, authPredicate, "", "")
	suite.NoError(err)
	suite.Len(projects, 0)
}

func (suite *ProjectQueriesSuite) TestGetByTeamSortByCreatedAtAsc() {
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, nil, models.SortByCreatedAt, models.SortOrderAsc)
	suite.NoError(err)
	suite.Len(projects, 2)

	// Should be ordered by created_at ascending
	suite.Equal(suite.testProject.ID, projects[0].ID)  // Created earlier
	suite.Equal(suite.testProject2.ID, projects[1].ID) // Created later
	suite.True(projects[0].CreatedAt.Before(projects[1].CreatedAt))
}

func (suite *ProjectQueriesSuite) TestGetByTeamSortByCreatedAtDesc() {
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, nil, models.SortByCreatedAt, models.SortOrderDesc)
	suite.NoError(err)
	suite.Len(projects, 2)

	// Should be ordered by created_at descending
	suite.Equal(suite.testProject2.ID, projects[0].ID) // Created later
	suite.Equal(suite.testProject.ID, projects[1].ID)  // Created earlier
	suite.True(projects[0].CreatedAt.After(projects[1].CreatedAt))
}

func (suite *ProjectQueriesSuite) TestGetByTeamSortByUpdatedAtAsc() {
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, nil, models.SortByUpdatedAt, models.SortOrderAsc)
	suite.NoError(err)
	suite.Len(projects, 2)

	// Should be ordered by updated_at ascending
	suite.Equal(suite.testProject.ID, projects[0].ID)  // Updated earlier
	suite.Equal(suite.testProject2.ID, projects[1].ID) // Updated later
	suite.True(projects[0].UpdatedAt.Before(projects[1].UpdatedAt))
}

func (suite *ProjectQueriesSuite) TestGetByTeamSortByUpdatedAtDesc() {
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, nil, models.SortByUpdatedAt, models.SortOrderDesc)
	suite.NoError(err)
	suite.Len(projects, 2)

	// Should be ordered by updated_at descending
	suite.Equal(suite.testProject2.ID, projects[0].ID) // Updated later
	suite.Equal(suite.testProject.ID, projects[1].ID)  // Updated earlier
	suite.True(projects[0].UpdatedAt.After(projects[1].UpdatedAt))
}

func (suite *ProjectQueriesSuite) TestGetByTeamSortByInvalidField() {
	// Invalid sort field should fallback to created_at ascending
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, nil, "invalid_field", models.SortOrderDesc)
	suite.NoError(err)
	suite.Len(projects, 2)

	// Should fallback to created_at ascending despite desc order specified
	suite.Equal(suite.testProject.ID, projects[0].ID)  // Created earlier
	suite.Equal(suite.testProject2.ID, projects[1].ID) // Created later
}

func (suite *ProjectQueriesSuite) TestGetByTeamSortWithAuthPredicate() {
	// Test sorting with auth predicate
	authPredicate := project.NameContains("Project")

	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, authPredicate, models.SortByCreatedAt, models.SortOrderDesc)
	suite.NoError(err)
	suite.Len(projects, 2)

	// Should be filtered and sorted
	suite.Equal(suite.testProject2.ID, projects[0].ID) // Created later
	suite.Equal(suite.testProject.ID, projects[1].ID)  // Created earlier
}

func (suite *ProjectQueriesSuite) TestGetByTeamNonExistentTeam() {
	nonExistentTeamID := uuid.New()
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, nonExistentTeamID, nil, "", "")
	suite.NoError(err)
	suite.Len(projects, 0)
}

func (suite *ProjectQueriesSuite) TestGetByTeamDBClosed() {
	suite.DB.Close()
	projects, err := suite.projectRepo.GetByTeam(suite.Ctx, suite.testTeam.ID, nil, "", "")
	suite.Error(err)
	suite.Nil(projects)
	suite.ErrorContains(err, "database is closed")
}

func TestProjectQueriesSuite(t *testing.T) {
	suite.Run(t, new(ProjectQueriesSuite))
}
