package environment_service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
	"k8s.io/client-go/kubernetes"
)

type DeleteEnvironmentSuite struct {
	services.ServiceTestSuite
	service *EnvironmentService

	// Test data
	testUserID        uuid.UUID
	testTeamID        uuid.UUID
	testProjectID     uuid.UUID
	testEnvironmentID uuid.UUID
	testBearerToken   string
	testTeam          *ent.Team
	testProject       *ent.Project
	testEnvironment   *ent.Environment
}

func (suite *DeleteEnvironmentSuite) SetupTest() {
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
	suite.testBearerToken = "test-bearer-token"

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

func (suite *DeleteEnvironmentSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *DeleteEnvironmentSuite) TestDeleteEnvironmentByID_PermissionDenied() {
	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.MatchedBy(func(checks []permissions_repo.PermissionCheck) bool {
			return len(checks) == 1 &&
				checks[0].Action == schema.ActionAdmin &&
				checks[0].ResourceType == schema.ResourceTypeEnvironment &&
				checks[0].ResourceID == suite.testEnvironmentID
		})).
		Return(errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Permission denied")).
		Once()

	// Execute
	err := suite.service.DeleteEnvironmentByID(suite.Ctx, suite.testUserID, suite.testBearerToken, suite.testTeamID, suite.testProjectID, suite.testEnvironmentID)

	// Assert
	suite.Error(err)
	suite.Contains(err.Error(), "Permission denied")
}

func (suite *DeleteEnvironmentSuite) TestDeleteEnvironmentByID_TeamNotFound() {
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
	err := suite.service.DeleteEnvironmentByID(suite.Ctx, suite.testUserID, suite.testBearerToken, suite.testTeamID, suite.testProjectID, suite.testEnvironmentID)

	// Assert
	suite.Error(err)
	suite.Contains(err.Error(), "Team not found")
}

func (suite *DeleteEnvironmentSuite) TestDeleteEnvironmentByID_LastEnvironmentInProject() {
	// Mock k8s client
	mockK8sClient := &kubernetes.Clientset{}

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

	suite.MockServiceRepo.EXPECT().
		GetByEnvironmentID(suite.Ctx, suite.testEnvironmentID, mock.AnythingOfType("predicate.Service"), false).
		Return([]*ent.Service{}, nil).
		Once()

	suite.MockK8s.EXPECT().
		CreateClientWithToken(suite.testBearerToken).
		Return(mockK8sClient, nil).
		Once()

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		Run(func(ctx context.Context, fn func(repository.TxInterface) error) {
			mockTx := suite.NewTxMockTyped()

			// Check if this is the last environment (it is)
			suite.MockEnvironmentRepo.EXPECT().
				GetForProject(suite.Ctx, mockTx, suite.testProjectID, mock.AnythingOfType("predicate.Environment")).
				Return([]*ent.Environment{suite.testEnvironment}, nil).
				Once()

			err := fn(mockTx)
			suite.Error(err)
			suite.Contains(err.Error(), "Cannot delete the last environment in a project")
		}).
		Return(errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Cannot delete the last environment in a project")).
		Once()

	// Execute
	err := suite.service.DeleteEnvironmentByID(suite.Ctx, suite.testUserID, suite.testBearerToken, suite.testTeamID, suite.testProjectID, suite.testEnvironmentID)

	// Assert
	suite.Error(err)
	suite.Contains(err.Error(), "Cannot delete the last environment in a project")
}

func (suite *DeleteEnvironmentSuite) TestDeleteEnvironmentByID_K8sClientCreationFails() {
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

	suite.MockServiceRepo.EXPECT().
		GetByEnvironmentID(suite.Ctx, suite.testEnvironmentID, mock.AnythingOfType("predicate.Service"), false).
		Return([]*ent.Service{}, nil).
		Once()

	suite.MockK8s.EXPECT().
		CreateClientWithToken(suite.testBearerToken).
		Return(nil, errors.New("k8s client creation failed")).
		Once()

	// Execute
	err := suite.service.DeleteEnvironmentByID(suite.Ctx, suite.testUserID, suite.testBearerToken, suite.testTeamID, suite.testProjectID, suite.testEnvironmentID)

	// Assert
	suite.Error(err)
	suite.Contains(err.Error(), "k8s client creation failed")
}

func TestDeleteEnvironmentSuite(t *testing.T) {
	suite.Run(t, new(DeleteEnvironmentSuite))
}
