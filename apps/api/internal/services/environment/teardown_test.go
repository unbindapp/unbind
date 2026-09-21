package environment_service

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/services"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
)

const teardownNamespace = "test-team-ns"

type TeardownSuite struct {
	services.ServiceTestSuite

	client      *kubernetes.Clientset
	tx          repository.TxInterface
	environment *ent.Environment
	service     *ent.Service
}

func (suite *TeardownSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()

	suite.client = &kubernetes.Clientset{}
	suite.tx = suite.NewTxMock()
	suite.environment = &ent.Environment{
		ID:               uuid.New(),
		KubernetesSecret: "test-env-secret",
	}
	suite.service = &ent.Service{
		ID:               uuid.New(),
		KubernetesName:   "test-service",
		KubernetesSecret: "test-service-secret",
		EnvironmentID:    suite.environment.ID,
	}
}

func (suite *TeardownSuite) teardown() error {
	return Teardown(suite.Ctx, suite.tx, suite.MockRepo, suite.MockK8s, suite.MockDeployCtl, suite.client, teardownNamespace, suite.environment, []*ent.Service{suite.service})
}

func (suite *TeardownSuite) expectServiceRemoved(secretErr error) {
	suite.MockDeployCtl.EXPECT().CancelExistingJobs(suite.Ctx, suite.service.ID).Return(nil).Once()
	suite.MockK8s.EXPECT().DeleteUnbindService(suite.Ctx, teardownNamespace, suite.service.KubernetesName).Return(nil).Once()
	suite.MockK8s.EXPECT().DeleteSecret(suite.Ctx, suite.service.KubernetesSecret, teardownNamespace, suite.client).Return(secretErr).Once()
}

func (suite *TeardownSuite) TestDeletesVolumesAndTheirMetadata() {
	suite.expectServiceRemoved(nil)
	suite.MockServiceRepo.EXPECT().Delete(suite.Ctx, suite.tx, suite.service.ID).Return(nil).Once()
	suite.MockK8s.EXPECT().
		DeletePersistentVolumeClaimsForEnvironment(suite.Ctx, teardownNamespace, suite.environment.ID, suite.client).
		Return([]string{"attached-volume", "unattached-volume"}, nil).
		Once()
	suite.MockSystemRepo.EXPECT().DeletePVCMetadata(suite.Ctx, suite.tx, "attached-volume").Return(nil).Once()
	suite.MockSystemRepo.EXPECT().DeletePVCMetadata(suite.Ctx, suite.tx, "unattached-volume").Return(nil).Once()
	suite.MockServiceGroupRepo.EXPECT().DeleteByEnvironmentID(suite.Ctx, suite.tx, suite.environment.ID).Return(nil).Once()
	suite.MockK8s.EXPECT().DeleteSecret(suite.Ctx, suite.environment.KubernetesSecret, teardownNamespace, suite.client).Return(nil).Once()
	suite.MockEnvironmentRepo.EXPECT().Delete(suite.Ctx, suite.tx, suite.environment.ID).Return(nil).Once()

	suite.NoError(suite.teardown())
}

func (suite *TeardownSuite) TestMissingSecretsDoNotBlockARetry() {
	missing := apierrors.NewNotFound(corev1.Resource("secrets"), "gone")

	suite.expectServiceRemoved(missing)
	suite.MockServiceRepo.EXPECT().Delete(suite.Ctx, suite.tx, suite.service.ID).Return(nil).Once()
	suite.MockK8s.EXPECT().
		DeletePersistentVolumeClaimsForEnvironment(suite.Ctx, teardownNamespace, suite.environment.ID, suite.client).
		Return(nil, nil).
		Once()
	suite.MockServiceGroupRepo.EXPECT().DeleteByEnvironmentID(suite.Ctx, suite.tx, suite.environment.ID).Return(nil).Once()
	suite.MockK8s.EXPECT().DeleteSecret(suite.Ctx, suite.environment.KubernetesSecret, teardownNamespace, suite.client).Return(missing).Once()
	suite.MockEnvironmentRepo.EXPECT().Delete(suite.Ctx, suite.tx, suite.environment.ID).Return(nil).Once()

	suite.NoError(suite.teardown())
}

func (suite *TeardownSuite) TestSecretFailureKeepsTheService() {
	suite.expectServiceRemoved(errors.New("apiserver unavailable"))

	suite.ErrorContains(suite.teardown(), "apiserver unavailable")
}

func (suite *TeardownSuite) TestVolumeFailureKeepsTheEnvironment() {
	suite.expectServiceRemoved(nil)
	suite.MockServiceRepo.EXPECT().Delete(suite.Ctx, suite.tx, suite.service.ID).Return(nil).Once()
	suite.MockK8s.EXPECT().
		DeletePersistentVolumeClaimsForEnvironment(suite.Ctx, teardownNamespace, suite.environment.ID, suite.client).
		Return(nil, errors.New("volume delete failed")).
		Once()

	suite.ErrorContains(suite.teardown(), "volume delete failed")
}

func TestTeardownSuite(t *testing.T) {
	suite.Run(t, new(TeardownSuite))
}
