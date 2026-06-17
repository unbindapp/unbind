package environment_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
)

type ReadEnvironmentSuite struct {
	services.ServiceTestSuite
	service *EnvironmentService

	// Test data
	testUserID        uuid.UUID
	testTeamID        uuid.UUID
	testProjectID     uuid.UUID
	testEnvironmentID uuid.UUID
	testTeam          *ent.Team
	testProject       *ent.Project
	testEnvironment   *ent.Environment
}

func (suite *ReadEnvironmentSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()

	// Initialize service with mocks
	suite.service = &EnvironmentService{
		repo:      suite.MockRepo,
		k8s:       suite.MockK8s,
		deployCtl: suite.MockDeployCtl,
	}

	// Test data
	suite.testUserID = uuid.New()
	suite.testTeamID = uuid.New()
	suite.testProjectID = uuid.New()
	suite.testEnvironmentID = uuid.New()

	suite.testTeam = &ent.Team{
		ID:               suite.testTeamID,
		Name:             "Test Team",
		KubernetesName:   "test-team",
		Namespace:        "test-team-ns",
		KubernetesSecret: "test-team-secret",
		Edges: ent.TeamEdges{
			Projects: []*ent.Project{},
		},
	}

	suite.testEnvironment = &ent.Environment{
		ID:               suite.testEnvironmentID,
		Name:             "Test Environment",
		KubernetesName:   "test-environment",
		KubernetesSecret: "test-env-secret",
		ProjectID:        suite.testProjectID,
		Description:      utils.ToPtr("Test environment description"),
	}

	suite.testProject = &ent.Project{
		ID:                   suite.testProjectID,
		Name:                 "Test Project",
		KubernetesName:       "test-project",
		KubernetesSecret:     "test-project-secret",
		TeamID:               suite.testTeamID,
		DefaultEnvironmentID: &suite.testEnvironmentID,
		Edges: ent.ProjectEdges{
			Team:         suite.testTeam,
			Environments: []*ent.Environment{suite.testEnvironment},
		},
	}

	suite.testTeam.Edges.Projects = []*ent.Project{suite.testProject}
}

func (suite *ReadEnvironmentSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *ReadEnvironmentSuite) TestGetEnvironmentByID_Success() {
	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.MatchedBy(func(checks []permissions_repo.PermissionCheck) bool {
			return len(checks) == 1 &&
				checks[0].Action == schema.ActionViewer &&
				checks[0].ResourceType == schema.ResourceTypeEnvironment &&
				checks[0].ResourceID == suite.testEnvironmentID
		})).
		Return(nil).
		Once()

	// VerifyInputs calls
	suite.MockTeamRepo.EXPECT().
		GetByID(suite.Ctx, suite.testTeamID).
		Return(suite.testTeam, nil).
		Once()

	// SummarizeServices call
	suite.MockServiceRepo.EXPECT().
		SummarizeServices(suite.Ctx, []uuid.UUID{suite.testEnvironmentID}).
		Return(
			map[uuid.UUID]int{suite.testEnvironmentID: 2},
			map[uuid.UUID][]string{suite.testEnvironmentID: {"postgres", "redis"}},
			nil,
		).
		Once()

	// Execute
	result, err := suite.service.GetEnvironmentByID(suite.Ctx, suite.testUserID, suite.testTeamID, suite.testProjectID, suite.testEnvironmentID)

	// Assert
	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(suite.testEnvironmentID, result.ID)
	suite.Equal("Test Environment", result.Name)
	suite.Equal("test-environment", result.KubernetesName)
	suite.Equal("Test environment description", result.Description)
	suite.Equal(2, result.ServiceCount)
	suite.Equal([]string{"postgres", "redis"}, result.ServiceIcons)
}

func (suite *ReadEnvironmentSuite) TestGetEnvironmentByID_PermissionDenied() {
	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Permission denied")).
		Once()

	// Execute
	result, err := suite.service.GetEnvironmentByID(suite.Ctx, suite.testUserID, suite.testTeamID, suite.testProjectID, suite.testEnvironmentID)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Permission denied")
}

func (suite *ReadEnvironmentSuite) TestGetEnvironmentByID_TeamNotFound() {
	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil).
		Once()

	suite.MockTeamRepo.EXPECT().
		GetByID(suite.Ctx, suite.testTeamID).
		Return(nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")).
		Once()

	// Execute
	result, err := suite.service.GetEnvironmentByID(suite.Ctx, suite.testUserID, suite.testTeamID, suite.testProjectID, suite.testEnvironmentID)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Team not found")
}

func (suite *ReadEnvironmentSuite) TestGetEnvironmentByID_ServiceSummaryFails() {
	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil).
		Once()

	// VerifyInputs calls
	suite.MockTeamRepo.EXPECT().
		GetByID(suite.Ctx, suite.testTeamID).
		Return(suite.testTeam, nil).
		Once()

	// SummarizeServices call fails
	suite.MockServiceRepo.EXPECT().
		SummarizeServices(suite.Ctx, []uuid.UUID{suite.testEnvironmentID}).
		Return(nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Failed to summarize services")).
		Once()

	// Execute
	result, err := suite.service.GetEnvironmentByID(suite.Ctx, suite.testUserID, suite.testTeamID, suite.testProjectID, suite.testEnvironmentID)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Failed to summarize services")
}

func (suite *ReadEnvironmentSuite) TestGetEnvironmentsByProjectID_Success() {
	// Create additional environments
	env2 := &ent.Environment{
		ID:               uuid.New(),
		Name:             "Development Environment",
		KubernetesName:   "dev-environment",
		KubernetesSecret: "dev-env-secret",
		ProjectID:        suite.testProjectID,
		Description:      utils.ToPtr("Development environment"),
	}

	env3 := &ent.Environment{
		ID:               uuid.New(),
		Name:             "Staging Environment",
		KubernetesName:   "staging-environment",
		KubernetesSecret: "staging-env-secret",
		ProjectID:        suite.testProjectID,
		Description:      utils.ToPtr("Staging environment"),
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		GetAccessibleEnvironmentPredicates(suite.Ctx, suite.testUserID, schema.ActionViewer, &suite.testProjectID).
		Return(nil, nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(suite.testProject, nil).
		Once()

	suite.MockEnvironmentRepo.EXPECT().
		GetForProject(suite.Ctx, nil, suite.testProjectID, mock.AnythingOfType("predicate.Environment")).
		Return([]*ent.Environment{suite.testEnvironment, env2, env3}, nil).
		Once()

	// Execute
	result, err := suite.service.GetEnvironmentsByProjectID(suite.Ctx, suite.testUserID, suite.testTeamID, suite.testProjectID)

	// Assert
	suite.NoError(err)
	suite.NotNil(result)
	suite.Len(result, 3)
	suite.Equal(suite.testEnvironmentID, result[0].ID)
	suite.Equal("Test Environment", result[0].Name)
	suite.Equal(env2.ID, result[1].ID)
	suite.Equal("Development Environment", result[1].Name)
	suite.Equal(env3.ID, result[2].ID)
	suite.Equal("Staging Environment", result[2].Name)
}

func (suite *ReadEnvironmentSuite) TestGetEnvironmentsByProjectID_PermissionPredicatesFail() {
	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		GetAccessibleEnvironmentPredicates(suite.Ctx, suite.testUserID, schema.ActionViewer, &suite.testProjectID).
		Return(nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Failed to get predicates")).
		Once()

	// Execute
	result, err := suite.service.GetEnvironmentsByProjectID(suite.Ctx, suite.testUserID, suite.testTeamID, suite.testProjectID)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "error getting accessible environment predicates")
}

func (suite *ReadEnvironmentSuite) TestGetEnvironmentsByProjectID_ProjectNotFound() {
	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		GetAccessibleEnvironmentPredicates(suite.Ctx, suite.testUserID, schema.ActionViewer, &suite.testProjectID).
		Return(nil, nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")).
		Once()

	// Execute
	result, err := suite.service.GetEnvironmentsByProjectID(suite.Ctx, suite.testUserID, suite.testTeamID, suite.testProjectID)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Project not found")
}

func (suite *ReadEnvironmentSuite) TestGetEnvironmentsByProjectID_TeamProjectMismatch() {
	// Different team
	differentTeamID := uuid.New()
	projectWithDifferentTeam := &ent.Project{
		ID:                   suite.testProjectID,
		Name:                 "Test Project",
		KubernetesName:       "test-project",
		KubernetesSecret:     "test-project-secret",
		TeamID:               differentTeamID, // Different team
		DefaultEnvironmentID: &suite.testEnvironmentID,
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		GetAccessibleEnvironmentPredicates(suite.Ctx, suite.testUserID, schema.ActionViewer, &suite.testProjectID).
		Return(nil, nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(projectWithDifferentTeam, nil).
		Once()

	// Execute
	result, err := suite.service.GetEnvironmentsByProjectID(suite.Ctx, suite.testUserID, suite.testTeamID, suite.testProjectID)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Project not found")
}

func TestReadEnvironmentSuite(t *testing.T) {
	suite.Run(t, new(ReadEnvironmentSuite))
}
