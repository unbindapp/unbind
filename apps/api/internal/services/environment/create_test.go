package environment_service

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type CreateEnvironmentSuite struct {
	services.ServiceTestSuite
	service *EnvironmentService

	// Test data
	testUserID      uuid.UUID
	testTeamID      uuid.UUID
	testProjectID   uuid.UUID
	testBearerToken string
	testTeam        *ent.Team
	testProject     *ent.Project
	testEnvironment *ent.Environment
}

func (suite *CreateEnvironmentSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()

	// Initialize service with mocks
	suite.service = &EnvironmentService{
		repo:      suite.MockRepo,
		k8s:       suite.MockK8s,
		deployCtl: &deployctl.DeploymentController{}, // Can be nil or mock if needed
	}

	// Test data
	suite.testUserID = uuid.New()
	suite.testTeamID = uuid.New()
	suite.testProjectID = uuid.New()
	suite.testBearerToken = "test-bearer-token"

	suite.testTeam = &ent.Team{
		ID:               suite.testTeamID,
		Name:             "Test Team",
		KubernetesName:   "test-team",
		Namespace:        "test-team-ns",
		KubernetesSecret: "test-team-secret",
	}

	suite.testProject = &ent.Project{
		ID:                   suite.testProjectID,
		Name:                 "Test Project",
		KubernetesName:       "test-project",
		KubernetesSecret:     "test-project-secret",
		TeamID:               suite.testTeamID,
		DefaultEnvironmentID: nil,
		Edges: ent.ProjectEdges{
			Team: suite.testTeam,
		},
	}

	suite.testEnvironment = &ent.Environment{
		ID:               uuid.New(),
		Name:             "Test Environment",
		KubernetesName:   "test-environment-abc123",
		KubernetesSecret: "test-environment-secret",
		ProjectID:        suite.testProjectID,
		Description:      utils.ToPtr("Test environment description"),
	}
}

func (suite *CreateEnvironmentSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *CreateEnvironmentSuite) TestCreateEnvironment_Success() {
	input := &CreateEnvironmentInput{
		TeamID:      suite.testTeamID,
		ProjectID:   suite.testProjectID,
		Name:        "Test Environment",
		Description: utils.ToPtr("Test environment description"),
	}

	expectedPermissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   suite.testProjectID,
		},
	}

	mockK8sClient := &kubernetes.Clientset{}
	mockSecret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-environment-dynamicname",
			Namespace: suite.testTeam.Namespace,
		},
		Data: map[string][]byte{},
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, expectedPermissionChecks).
		Return(nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(suite.testProject, nil).
		Once()

	suite.MockK8s.EXPECT().
		CreateClientWithToken(suite.testBearerToken).
		Return(mockK8sClient, nil).
		Once()

	suite.MockK8s.EXPECT().
		GetOrCreateSecret(suite.Ctx, mock.MatchedBy(func(secretName string) bool {
			return strings.HasPrefix(secretName, "test-environment-") && len(secretName) > len("test-environment-")
		}), suite.testTeam.Namespace, mockK8sClient).
		Return(mockSecret, true, nil).
		Once()

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		Run(func(ctx context.Context, fn func(repository.TxInterface) error) {
			mockTx := suite.NewTxMockTyped()

			suite.MockEnvironmentRepo.EXPECT().
				Create(suite.Ctx, mockTx, mock.MatchedBy(func(kubernetesName string) bool {
					return strings.HasPrefix(kubernetesName, "test-environment-") && len(kubernetesName) > len("test-environment-")
				}), "Test Environment", "test-environment-dynamicname", input.Description, suite.testProjectID).
				Return(suite.testEnvironment, nil).
				Once()

			suite.MockProjectRepo.EXPECT().
				Update(suite.Ctx, mockTx, suite.testProjectID, &suite.testEnvironment.ID, "", (*string)(nil)).
				Return(suite.testProject, nil).
				Once()

			err := fn(mockTx)
			suite.NoError(err)
		}).
		Return(nil).
		Once()

	suite.MockServiceRepo.EXPECT().
		SummarizeServices(suite.Ctx, []uuid.UUID{suite.testEnvironment.ID}).
		Return(
			map[uuid.UUID]int{suite.testEnvironment.ID: 0},
			map[uuid.UUID][]string{suite.testEnvironment.ID: {}},
			nil,
		).
		Once()

	// Execute
	result, err := suite.service.CreateEnvironment(suite.Ctx, suite.testUserID, input, suite.testBearerToken)

	// Assert
	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(suite.testEnvironment.ID, result.ID)
	suite.Equal("Test Environment", result.Name)
	// KubernetesName will have a random suffix, so just check it starts with expected prefix
	suite.True(strings.HasPrefix(result.KubernetesName, "test-environment-"))
	suite.Equal(0, result.ServiceCount)
	suite.Empty(result.ServiceIcons)
}

func (suite *CreateEnvironmentSuite) TestCreateEnvironment_PermissionDenied() {
	input := &CreateEnvironmentInput{
		TeamID:    suite.testTeamID,
		ProjectID: suite.testProjectID,
		Name:      "Test Environment",
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Permission denied")).
		Once()

	// Execute
	result, err := suite.service.CreateEnvironment(suite.Ctx, suite.testUserID, input, suite.testBearerToken)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Permission denied")
}

func (suite *CreateEnvironmentSuite) TestCreateEnvironment_ProjectNotFound() {
	input := &CreateEnvironmentInput{
		TeamID:    suite.testTeamID,
		ProjectID: suite.testProjectID,
		Name:      "Test Environment",
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(nil, &ent.NotFoundError{}).
		Once()

	// Execute
	result, err := suite.service.CreateEnvironment(suite.Ctx, suite.testUserID, input, suite.testBearerToken)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Project not found")
}

func (suite *CreateEnvironmentSuite) TestCreateEnvironment_K8sClientCreationFails() {
	input := &CreateEnvironmentInput{
		TeamID:    suite.testTeamID,
		ProjectID: suite.testProjectID,
		Name:      "Test Environment",
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(suite.testProject, nil).
		Once()

	suite.MockK8s.EXPECT().
		CreateClientWithToken(suite.testBearerToken).
		Return(nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Failed to create k8s client")).
		Once()

	// Execute
	result, err := suite.service.CreateEnvironment(suite.Ctx, suite.testUserID, input, suite.testBearerToken)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Failed to create k8s client")
}

func (suite *CreateEnvironmentSuite) TestCreateEnvironment_SecretCreationFails() {
	input := &CreateEnvironmentInput{
		TeamID:    suite.testTeamID,
		ProjectID: suite.testProjectID,
		Name:      "Test Environment",
	}

	mockK8sClient := &kubernetes.Clientset{}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(suite.testProject, nil).
		Once()

	suite.MockK8s.EXPECT().
		CreateClientWithToken(suite.testBearerToken).
		Return(mockK8sClient, nil).
		Once()

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		Run(func(ctx context.Context, fn func(repository.TxInterface) error) {
			mockTx := suite.NewTxMockTyped()

			suite.MockK8s.EXPECT().
				GetOrCreateSecret(suite.Ctx, mock.MatchedBy(func(secretName string) bool {
					return strings.HasPrefix(secretName, "test-environment-") && len(secretName) > len("test-environment-")
				}), suite.testTeam.Namespace, mockK8sClient).
				Return(nil, false, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Failed to create secret")).
				Once()

			err := fn(mockTx)
			suite.Error(err)
		}).
		Return(errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Failed to create secret")).
		Once()

	// Execute
	result, err := suite.service.CreateEnvironment(suite.Ctx, suite.testUserID, input, suite.testBearerToken)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Failed to create secret")
}

func (suite *CreateEnvironmentSuite) TestCreateEnvironment_DatabaseTransactionFails() {
	input := &CreateEnvironmentInput{
		TeamID:    suite.testTeamID,
		ProjectID: suite.testProjectID,
		Name:      "Test Environment",
	}

	mockK8sClient := &kubernetes.Clientset{}
	mockSecret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-environment-dynamicname",
			Namespace: suite.testTeam.Namespace,
		},
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(suite.testProject, nil).
		Once()

	suite.MockK8s.EXPECT().
		CreateClientWithToken(suite.testBearerToken).
		Return(mockK8sClient, nil).
		Once()

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		Run(func(ctx context.Context, fn func(repository.TxInterface) error) {
			mockTx := suite.NewTxMockTyped()

			suite.MockK8s.EXPECT().
				GetOrCreateSecret(suite.Ctx, mock.MatchedBy(func(secretName string) bool {
					return strings.HasPrefix(secretName, "test-environment-") && len(secretName) > len("test-environment-")
				}), suite.testTeam.Namespace, mockK8sClient).
				Return(mockSecret, true, nil).
				Once()

			suite.MockEnvironmentRepo.EXPECT().
				Create(suite.Ctx, mockTx, mock.MatchedBy(func(kubernetesName string) bool {
					return strings.HasPrefix(kubernetesName, "test-environment-") && len(kubernetesName) > len("test-environment-")
				}), "Test Environment", "test-environment-dynamicname", (*string)(nil), suite.testProjectID).
				Return(nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment name already exists")).
				Once()

			err := fn(mockTx)
			suite.Error(err)
		}).
		Return(errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment name already exists")).
		Once()

	// Execute
	result, err := suite.service.CreateEnvironment(suite.Ctx, suite.testUserID, input, suite.testBearerToken)

	// Assert
	suite.Error(err)
	suite.Nil(result)
	suite.Contains(err.Error(), "Environment name already exists")
}

func (suite *CreateEnvironmentSuite) TestCreateEnvironment_SuccessAsFirstEnvironment() {
	input := &CreateEnvironmentInput{
		TeamID:    suite.testTeamID,
		ProjectID: suite.testProjectID,
		Name:      "First Environment",
	}

	// Project has no default environment
	projectWithoutDefault := &ent.Project{
		ID:                   suite.testProjectID,
		Name:                 "Test Project",
		KubernetesName:       "test-project",
		KubernetesSecret:     "test-project-secret",
		TeamID:               suite.testTeamID,
		DefaultEnvironmentID: nil, // No default environment
		Edges: ent.ProjectEdges{
			Team: suite.testTeam,
		},
	}

	mockK8sClient := &kubernetes.Clientset{}
	mockSecret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "first-environment-dynamicname",
			Namespace: suite.testTeam.Namespace,
		},
	}

	// Setup expectations
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil).
		Once()

	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(projectWithoutDefault, nil).
		Once()

	suite.MockK8s.EXPECT().
		CreateClientWithToken(suite.testBearerToken).
		Return(mockK8sClient, nil).
		Once()

	firstEnvironment := &ent.Environment{
		ID:               suite.testEnvironment.ID,
		Name:             "First Environment",
		KubernetesName:   "first-environment-abc123",
		KubernetesSecret: "first-environment-secret",
		ProjectID:        suite.testProjectID,
		Description:      nil,
	}

	suite.MockK8s.EXPECT().
		GetOrCreateSecret(suite.Ctx, mock.MatchedBy(func(secretName string) bool {
			return strings.HasPrefix(secretName, "first-environment-") && len(secretName) > len("first-environment-")
		}), suite.testTeam.Namespace, mockK8sClient).
		Return(mockSecret, true, nil).
		Once()

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		Run(func(ctx context.Context, fn func(repository.TxInterface) error) {
			mockTx := suite.NewTxMockTyped()

			suite.MockEnvironmentRepo.EXPECT().
				Create(suite.Ctx, mockTx, mock.MatchedBy(func(kubernetesName string) bool {
					return strings.HasPrefix(kubernetesName, "first-environment-") && len(kubernetesName) > len("first-environment-")
				}), "First Environment", "first-environment-dynamicname", (*string)(nil), suite.testProjectID).
				Return(firstEnvironment, nil).
				Once()

			// Should set as default environment since project has none
			suite.MockProjectRepo.EXPECT().
				Update(suite.Ctx, mockTx, suite.testProjectID, &firstEnvironment.ID, "", (*string)(nil)).
				Return(projectWithoutDefault, nil).
				Once()

			err := fn(mockTx)
			suite.NoError(err)
		}).
		Return(nil).
		Once()

	suite.MockServiceRepo.EXPECT().
		SummarizeServices(suite.Ctx, []uuid.UUID{firstEnvironment.ID}).
		Return(
			map[uuid.UUID]int{firstEnvironment.ID: 0},
			map[uuid.UUID][]string{firstEnvironment.ID: {}},
			nil,
		).
		Once()

	// Execute
	result, err := suite.service.CreateEnvironment(suite.Ctx, suite.testUserID, input, suite.testBearerToken)

	// Assert
	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(firstEnvironment.ID, result.ID)
	suite.Equal("First Environment", result.Name)
}

func TestCreateEnvironmentSuite(t *testing.T) {
	suite.Run(t, new(CreateEnvironmentSuite))
}
