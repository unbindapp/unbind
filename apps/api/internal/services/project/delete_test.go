package project_service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/services"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
)

type DeleteProjectSuite struct {
	services.ServiceTestSuite
	service *ProjectService
	userID  uuid.UUID
	client  *kubernetes.Clientset
	team    *ent.Team
	project *ent.Project
}

func (suite *DeleteProjectSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &ProjectService{cfg: &config.Config{}, repo: suite.MockRepo, k8s: suite.MockK8s}
	suite.userID = uuid.New()
	suite.client = &kubernetes.Clientset{}
	suite.project = &ent.Project{ID: uuid.New(), Name: "Test Project", KubernetesSecret: "test-project-secret"}
	suite.team = &ent.Team{
		ID:        uuid.New(),
		Namespace: "team-ns",
		Edges:     ent.TeamEdges{Projects: []*ent.Project{suite.project}},
	}
	suite.project.TeamID = suite.team.ID

	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.userID, mock.Anything).Return(nil).Once()
	suite.MockTeamRepo.EXPECT().GetByID(suite.Ctx, suite.team.ID).Return(suite.team, nil).Once()
	suite.MockK8s.EXPECT().GetInternalClient().Return(suite.client)
	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		RunAndReturn(func(ctx context.Context, fn func(repository.TxInterface) error) error {
			return fn(suite.NewTxMockTyped())
		}).
		Once()
}

func (suite *DeleteProjectSuite) expectEnvironmentTornDown(environment *ent.Environment, volumes []string) {
	suite.MockK8s.EXPECT().
		DeletePersistentVolumeClaimsForEnvironment(suite.Ctx, suite.team.Namespace, environment.ID, suite.client).
		Return(volumes, nil).
		Once()
	for _, volume := range volumes {
		suite.MockSystemRepo.EXPECT().DeletePVCMetadata(suite.Ctx, mock.Anything, volume).Return(nil).Once()
	}
	suite.MockServiceGroupRepo.EXPECT().DeleteByEnvironmentID(suite.Ctx, mock.Anything, environment.ID).Return(nil).Once()
	suite.MockK8s.EXPECT().DeleteSecret(suite.Ctx, environment.KubernetesSecret, suite.team.Namespace, suite.client).Return(nil).Once()
	suite.MockEnvironmentRepo.EXPECT().Delete(suite.Ctx, mock.Anything, environment.ID).Return(nil).Once()
}

func (suite *DeleteProjectSuite) TestDeletesVolumesOfEveryEnvironment() {
	production := &ent.Environment{ID: uuid.New(), KubernetesSecret: "production-secret"}
	staging := &ent.Environment{ID: uuid.New(), KubernetesSecret: "staging-secret"}
	suite.MockEnvironmentRepo.EXPECT().
		GetForProject(suite.Ctx, mock.Anything, suite.project.ID, mock.Anything).
		Return([]*ent.Environment{production, staging}, nil).
		Once()
	suite.expectEnvironmentTornDown(production, []string{"production-volume"})
	suite.expectEnvironmentTornDown(staging, []string{"staging-volume"})

	missing := apierrors.NewNotFound(corev1.Resource("secrets"), suite.project.KubernetesSecret)
	suite.MockK8s.EXPECT().DeleteSecret(suite.Ctx, suite.project.KubernetesSecret, suite.team.Namespace, suite.client).Return(missing).Once()
	suite.MockProjectRepo.EXPECT().Delete(suite.Ctx, mock.Anything, suite.project.ID).Return(nil).Once()

	webhookAttempted := make(chan struct{})
	suite.MockUserRepo.EXPECT().
		GetByID(mock.Anything, suite.userID).
		RunAndReturn(func(ctx context.Context, userID uuid.UUID) (*ent.User, error) {
			close(webhookAttempted)
			return nil, errors.New("no user in this test")
		}).
		Once()

	err := suite.service.DeleteProject(suite.Ctx, suite.userID, &DeleteProjectInput{TeamID: suite.team.ID, ProjectID: suite.project.ID})
	suite.NoError(err)

	select {
	case <-webhookAttempted:
	case <-time.After(5 * time.Second):
		suite.Fail("webhook goroutine never ran")
	}
}

func (suite *DeleteProjectSuite) TestVolumeFailureKeepsTheProject() {
	production := &ent.Environment{ID: uuid.New(), KubernetesSecret: "production-secret"}
	suite.MockEnvironmentRepo.EXPECT().
		GetForProject(suite.Ctx, mock.Anything, suite.project.ID, mock.Anything).
		Return([]*ent.Environment{production}, nil).
		Once()
	suite.MockK8s.EXPECT().
		DeletePersistentVolumeClaimsForEnvironment(suite.Ctx, suite.team.Namespace, production.ID, suite.client).
		Return(nil, errors.New("volume delete failed")).
		Once()

	err := suite.service.DeleteProject(suite.Ctx, suite.userID, &DeleteProjectInput{TeamID: suite.team.ID, ProjectID: suite.project.ID})
	suite.ErrorContains(err, "volume delete failed")
}

func TestDeleteProjectSuite(t *testing.T) {
	suite.Run(t, new(DeleteProjectSuite))
}
