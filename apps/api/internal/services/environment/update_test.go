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

type UpdateEnvironmentSuite struct {
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

func (suite *UpdateEnvironmentSuite) SetupTest() {
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
		Description:      utils.ToPtr("Original description"),
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

func (suite *UpdateEnvironmentSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *UpdateEnvironmentSuite) TestUpdateEnvironment_Success() {
	input := &UpdateEnvironmentInput{
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		Name:          utils.ToPtr("Updated Environment Name"),
		Description:   utils.ToPtr("Updated description"),
	}

	updatedEnvironment := &ent.Environment{
		ID:               suite.testEnvironmentID,
		Name:             "Updated Environment Name",
		KubernetesName:   "test-environment",
		KubernetesSecret: "test-env-secret",
		ProjectID:        suite.testProjectID,
		Description:      utils.ToPtr("Updated description"),
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.MatchedBy(func(checks []permissions_repo.PermissionCheck) bool {
			return len(checks) == 1 &&
				checks[0].Action == schema.ActionEditor &&
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

	// Update environment
	suite.MockEnvironmentRepo.EXPECT().
		Update(suite.Ctx, suite.testEnvironmentID, input.Name, input.Description).
		Return(updatedEnvironment, nil).
		Once()

	// SummarizeServices call
	suite.MockServiceRepo.EXPECT().
		SummarizeServices(suite.Ctx, []uuid.UUID{suite.testEnvironmentID}).
		Return(
			map[uuid.UUID]int{suite.testEnvironmentID: 3},
			map[uuid.UUID][]string{suite.testEnvironmentID: {"postgres", "redis", "nginx"}},
			nil,
		).
		Once()

	// Execute
	result, err := suite.service.UpdateEnvironment(suite.Ctx, suite.testUserID, input)

	// Assert
	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(suite.testEnvironmentID, result.ID)
	suite.Equal("Updated Environment Name", result.Name)
	suite.Equal("test-environment", result.KubernetesName)
	suite.Equal("Updated description", result.Description)
	suite.Equal(3, result.ServiceCount)
	suite.Equal([]string{"postgres", "redis", "nginx"}, result.ServiceIcons)
}

func (suite *UpdateEnvironmentSuite) TestUpdateEnvironment_NameOnly() {
	input := &UpdateEnvironmentInput{
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		Name:          utils.ToPtr("New Name Only"),
		Description:   nil, // Not updating description
	}

	updatedEnvironment := &ent.Environment{
		ID:               suite.testEnvironmentID,
		Name:             "New Name Only",
		KubernetesName:   "test-environment",
		KubernetesSecret: "test-env-secret",
		ProjectID:        suite.testProjectID,
		Description:      utils.ToPtr("Original description"), // Unchanged
	}

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

	// Update environment
	suite.MockEnvironmentRepo.EXPECT().
		Update(suite.Ctx, suite.testEnvironmentID, input.Name, (*string)(nil)).
		Return(updatedEnvironment, nil).
		Once()

	// SummarizeServices call
	suite.MockServiceRepo.EXPECT().
		SummarizeServices(suite.Ctx, []uuid.UUID{suite.testEnvironmentID}).
		Return(
			map[uuid.UUID]int{suite.testEnvironmentID: 1},
			map[uuid.UUID][]string{suite.testEnvironmentID: {"postgres"}},
			nil,
		).
		Once()

	// Execute
	result, err := suite.service.UpdateEnvironment(suite.Ctx, suite.testUserID, input)

	// Assert
	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(suite.testEnvironmentID, result.ID)
	suite.Equal("New Name Only", result.Name)
	suite.Equal("Original description", result.Description)
	suite.Equal(1, result.ServiceCount)
}

func (suite *UpdateEnvironmentSuite) TestUpdateEnvironment_DescriptionOnly() {
	input := &UpdateEnvironmentInput{
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		Name:          nil, // Not updating name
		Description:   utils.ToPtr("New description only"),
	}

	updatedEnvironment := &ent.Environment{
		ID:               suite.testEnvironmentID,
		Name:             "Test Environment", // Unchanged
		KubernetesName:   "test-environment",
		KubernetesSecret: "test-env-secret",
		ProjectID:        suite.testProjectID,
		Description:      utils.ToPtr("New description only"),
	}

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

	// Update environment
	suite.MockEnvironmentRepo.EXPECT().
		Update(suite.Ctx, suite.testEnvironmentID, (*string)(nil), input.Description).
		Return(updatedEnvironment, nil).
		Once()

	// SummarizeServices call
	suite.MockServiceRepo.EXPECT().
		SummarizeServices(suite.Ctx, []uuid.UUID{suite.testEnvironmentID}).
		Return(
			map[uuid.UUID]int{suite.testEnvironmentID: 0},
			map[uuid.UUID][]string{suite.testEnvironmentID: {}},
			nil,
		).
		Once()

	// Execute
	result, err := suite.service.UpdateEnvironment(suite.Ctx, suite.testUserID, input)

	// Assert
	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(suite.testEnvironmentID, result.ID)
	suite.Equal("Test Environment", result.Name)
	suite.Equal("New description only", result.Description)
	suite.Equal(0, result.ServiceCount)
	suite.Empty(result.ServiceIcons)
}

func (suite *UpdateEnvironmentSuite) TestUpdateEnvironment_PermissionDenied() {
	input := &UpdateEnvironmentInput{
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		Name:          utils.ToPtr("New Name"),
		Description:   utils.ToPtr("New description"),
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Permission denied")).
		Once()

	// Execute
	result, err := suite.service.UpdateEnvironment(suite.Ctx, suite.testUserID, input)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Permission denied")
}

func (suite *UpdateEnvironmentSuite) TestUpdateEnvironment_TeamNotFound() {
	input := &UpdateEnvironmentInput{
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		Name:          utils.ToPtr("New Name"),
		Description:   utils.ToPtr("New description"),
	}

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
	result, err := suite.service.UpdateEnvironment(suite.Ctx, suite.testUserID, input)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Team not found")
}

func (suite *UpdateEnvironmentSuite) TestUpdateEnvironment_EnvironmentNotFound() {
	// Create a team without the environment in project edges (simulates environment not found)
	teamWithoutEnv := &ent.Team{
		ID:               suite.testTeamID,
		Name:             "Test Team",
		KubernetesName:   "test-team",
		Namespace:        "test-team-ns",
		KubernetesSecret: "test-team-secret",
		Edges: ent.TeamEdges{
			Projects: []*ent.Project{
				{
					ID:                   suite.testProjectID,
					Name:                 "Test Project",
					KubernetesName:       "test-project",
					KubernetesSecret:     "test-project-secret",
					TeamID:               suite.testTeamID,
					DefaultEnvironmentID: &suite.testEnvironmentID,
					Edges: ent.ProjectEdges{
						Environments: []*ent.Environment{}, // No environments
					},
				},
			},
		},
	}

	input := &UpdateEnvironmentInput{
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		Name:          utils.ToPtr("New Name"),
		Description:   utils.ToPtr("New description"),
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil).
		Once()

	suite.MockTeamRepo.EXPECT().
		GetByID(suite.Ctx, suite.testTeamID).
		Return(teamWithoutEnv, nil).
		Once()

	// Execute
	result, err := suite.service.UpdateEnvironment(suite.Ctx, suite.testUserID, input)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Environment not found")
}

func (suite *UpdateEnvironmentSuite) TestUpdateEnvironment_UpdateFails() {
	input := &UpdateEnvironmentInput{
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		Name:          utils.ToPtr("New Name"),
		Description:   utils.ToPtr("New description"),
	}

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

	// Update environment fails
	suite.MockEnvironmentRepo.EXPECT().
		Update(suite.Ctx, suite.testEnvironmentID, input.Name, input.Description).
		Return(nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Update failed")).
		Once()

	// Execute
	result, err := suite.service.UpdateEnvironment(suite.Ctx, suite.testUserID, input)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Update failed")
}

func (suite *UpdateEnvironmentSuite) TestUpdateEnvironment_ServiceSummaryFails() {
	input := &UpdateEnvironmentInput{
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		Name:          utils.ToPtr("New Name"),
		Description:   utils.ToPtr("New description"),
	}

	updatedEnvironment := &ent.Environment{
		ID:               suite.testEnvironmentID,
		Name:             "New Name",
		KubernetesName:   "test-environment",
		KubernetesSecret: "test-env-secret",
		ProjectID:        suite.testProjectID,
		Description:      utils.ToPtr("New description"),
	}

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

	// Update environment
	suite.MockEnvironmentRepo.EXPECT().
		Update(suite.Ctx, suite.testEnvironmentID, input.Name, input.Description).
		Return(updatedEnvironment, nil).
		Once()

	// SummarizeServices call fails
	suite.MockServiceRepo.EXPECT().
		SummarizeServices(suite.Ctx, []uuid.UUID{suite.testEnvironmentID}).
		Return(nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Service summary failed")).
		Once()

	// Execute
	result, err := suite.service.UpdateEnvironment(suite.Ctx, suite.testUserID, input)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Service summary failed")
}

func TestUpdateEnvironmentSuite(t *testing.T) {
	suite.Run(t, new(UpdateEnvironmentSuite))
}
