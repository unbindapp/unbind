package variables_service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_permissions "github.com/unbindapp/unbind-api/mocks/repository/permissions"
	mocks_repository_service "github.com/unbindapp/unbind-api/mocks/repository/service"
	mocks_repository_variables "github.com/unbindapp/unbind-api/mocks/repository/variables"
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
)

// This service can't reuse services.ServiceTestSuite: deployctl imports
// variables_service, so importing the shared base would create a test import
// cycle. We wire up the handful of mocks it actually needs directly.
type ResolveReferencesSuite struct {
	suite.Suite
	ctx       context.Context
	service   *VariablesService
	k8sClient *kubernetes.Clientset

	repo     *mocks_repositories.RepositoriesMock
	perms    *mocks_repository_permissions.PermissionsRepositoryMock
	svcRepo  *mocks_repository_service.ServiceRepositoryMock
	varsRepo *mocks_repository_variables.VariablesRepositoryMock
	k8s      *mocks_infrastructure_k8s.KubeClientMock

	userID    uuid.UUID
	serviceID uuid.UUID
	namespace string
	token     string
}

func (suite *ResolveReferencesSuite) SetupTest() {
	suite.ctx = context.Background()

	suite.repo = mocks_repositories.NewRepositoriesMock(suite.T())
	suite.perms = mocks_repository_permissions.NewPermissionsRepositoryMock(suite.T())
	suite.svcRepo = mocks_repository_service.NewServiceRepositoryMock(suite.T())
	suite.varsRepo = mocks_repository_variables.NewVariablesRepositoryMock(suite.T())
	suite.k8s = mocks_infrastructure_k8s.NewKubeClientMock(suite.T())

	suite.repo.EXPECT().Permissions().Return(suite.perms).Maybe()
	suite.repo.EXPECT().Service().Return(suite.svcRepo).Maybe()
	suite.repo.EXPECT().Variables().Return(suite.varsRepo).Maybe()

	suite.service = &VariablesService{repo: suite.repo, k8s: suite.k8s}
	suite.k8sClient = &kubernetes.Clientset{}
	suite.userID = uuid.New()
	suite.serviceID = uuid.New()
	suite.namespace = "test-namespace"
	suite.token = "test-token"
}

// secretRef returns a reference whose template "${api.KEY}" resolves from the
// "KEY" entry of the "api" secret.
func (suite *ResolveReferencesSuite) secretRef(targetName string) *ent.VariableReference {
	return &ent.VariableReference{
		ID:              uuid.New(),
		TargetServiceID: suite.serviceID,
		TargetName:      targetName,
		ValueTemplate:   "${api.KEY}",
		Sources: []schema.VariableReferenceSource{{
			Type:                 schema.VariableReferenceTypeVariable,
			SourceType:           schema.VariableReferenceSourceTypeService,
			SourceID:             uuid.New(),
			SourceKubernetesName: "api",
			Key:                  "KEY",
		}},
	}
}

func (suite *ResolveReferencesSuite) expectViewerCheck(ret error) {
	suite.perms.EXPECT().
		Check(suite.ctx, suite.userID, []permissions_repo.PermissionCheck{{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   suite.serviceID,
		}}).
		Return(ret).
		Once()
}

func (suite *ResolveReferencesSuite) secret(value string) *corev1.Secret {
	return &corev1.Secret{Data: map[string][]byte{"KEY": []byte(value)}}
}

func (suite *ResolveReferencesSuite) TestResolveSingleReference_PermissionDenied() {
	denied := errors.New("permission denied")
	suite.expectViewerCheck(denied)

	// No client or repo access happens once the permission check fails.
	_, err := suite.service.ResolveSingleReference(suite.ctx, suite.userID, suite.token, suite.serviceID, uuid.New())
	suite.ErrorIs(err, denied)
}

func (suite *ResolveReferencesSuite) TestResolveSingleReference_NotFound() {
	suite.expectViewerCheck(nil)
	suite.k8s.EXPECT().CreateClientWithToken(suite.token).Return(suite.k8sClient, nil).Once()
	suite.varsRepo.EXPECT().GetReferenceByID(suite.ctx, mock.Anything).Return(nil, &ent.NotFoundError{}).Once()

	_, err := suite.service.ResolveSingleReference(suite.ctx, suite.userID, suite.token, suite.serviceID, uuid.New())
	suite.ErrorContains(err, "Variable reference not found")
}

// A reference belonging to a different service must not be resolvable through
// this service, even though it exists.
func (suite *ResolveReferencesSuite) TestResolveSingleReference_WrongService() {
	ref := suite.secretRef("DB_URL")
	ref.TargetServiceID = uuid.New() // not suite.serviceID

	suite.expectViewerCheck(nil)
	suite.k8s.EXPECT().CreateClientWithToken(suite.token).Return(suite.k8sClient, nil).Once()
	suite.varsRepo.EXPECT().GetReferenceByID(suite.ctx, ref.ID).Return(ref, nil).Once()

	_, err := suite.service.ResolveSingleReference(suite.ctx, suite.userID, suite.token, suite.serviceID, ref.ID)
	suite.ErrorContains(err, "Variable reference not found")
}

func (suite *ResolveReferencesSuite) TestResolveSingleReference_Success() {
	ref := suite.secretRef("DB_URL")

	suite.expectViewerCheck(nil)
	suite.k8s.EXPECT().CreateClientWithToken(suite.token).Return(suite.k8sClient, nil).Once()
	suite.varsRepo.EXPECT().GetReferenceByID(suite.ctx, ref.ID).Return(ref, nil).Once()
	suite.svcRepo.EXPECT().GetDeploymentNamespace(suite.ctx, suite.serviceID).Return(suite.namespace, nil).Once()
	suite.k8s.EXPECT().GetSecret(suite.ctx, "api", suite.namespace, suite.k8sClient).Return(suite.secret("resolved-value"), nil).Once()

	value, err := suite.service.ResolveSingleReference(suite.ctx, suite.userID, suite.token, suite.serviceID, ref.ID)
	suite.NoError(err)
	suite.Equal("resolved-value", value)
}

// When a source can't be resolved, the failure is persisted onto the reference
// before being returned to the caller.
func (suite *ResolveReferencesSuite) TestResolveSingleReference_AttachesErrorOnFailure() {
	ref := suite.secretRef("DB_URL")

	suite.expectViewerCheck(nil)
	suite.k8s.EXPECT().CreateClientWithToken(suite.token).Return(suite.k8sClient, nil).Once()
	suite.varsRepo.EXPECT().GetReferenceByID(suite.ctx, ref.ID).Return(ref, nil).Once()
	suite.svcRepo.EXPECT().GetDeploymentNamespace(suite.ctx, suite.serviceID).Return(suite.namespace, nil).Once()
	suite.k8s.EXPECT().GetSecret(suite.ctx, "api", suite.namespace, suite.k8sClient).
		Return(nil, k8serrors.NewNotFound(corev1.Resource("secrets"), "api")).Once()
	suite.varsRepo.EXPECT().AttachError(suite.ctx, ref.ID, mock.Anything).Return(nil, nil).Once()

	_, err := suite.service.ResolveSingleReference(suite.ctx, suite.userID, suite.token, suite.serviceID, ref.ID)
	suite.ErrorContains(err, "Unable to resolve variable")
}

// Empty reference set resolves to an empty map without touching kubernetes.
func (suite *ResolveReferencesSuite) TestResolveAllReferences_Empty() {
	suite.varsRepo.EXPECT().GetReferencesForService(suite.ctx, suite.serviceID).Return(nil, nil).Once()

	result, err := suite.service.ResolveAllReferences(suite.ctx, suite.serviceID)
	suite.NoError(err)
	suite.Empty(result)
}

func (suite *ResolveReferencesSuite) TestResolveAllReferences_RepoError() {
	repoErr := errors.New("db down")
	suite.varsRepo.EXPECT().GetReferencesForService(suite.ctx, suite.serviceID).Return(nil, repoErr).Once()

	_, err := suite.service.ResolveAllReferences(suite.ctx, suite.serviceID)
	suite.ErrorIs(err, repoErr)
}

func (suite *ResolveReferencesSuite) TestResolveAllReferences_Success() {
	ref := suite.secretRef("DB_URL")

	suite.varsRepo.EXPECT().GetReferencesForService(suite.ctx, suite.serviceID).Return([]*ent.VariableReference{ref}, nil).Once()
	suite.svcRepo.EXPECT().GetDeploymentNamespace(suite.ctx, suite.serviceID).Return(suite.namespace, nil).Once()
	suite.k8s.EXPECT().GetInternalClient().Return(suite.k8sClient).Once()
	suite.k8s.EXPECT().GetSecret(suite.ctx, "api", suite.namespace, suite.k8sClient).Return(suite.secret("resolved-value"), nil).Once()

	result, err := suite.service.ResolveAllReferences(suite.ctx, suite.serviceID)
	suite.NoError(err)
	suite.Equal(map[string]string{"DB_URL": "resolved-value"}, result)
}

func TestResolveReferencesSuite(t *testing.T) {
	suite.Run(t, new(ResolveReferencesSuite))
}
