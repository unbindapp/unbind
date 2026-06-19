package terminal_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
)

type ResolveSuite struct {
	services.ServiceTestSuite
	service *TerminalService

	userID        uuid.UUID
	teamID        uuid.UUID
	projectID     uuid.UUID
	environmentID uuid.UUID
	serviceID     uuid.UUID
	input         *ExecInput
}

func (suite *ResolveSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &TerminalService{repo: suite.MockRepo, k8s: suite.MockK8s}

	suite.userID = uuid.New()
	suite.teamID = uuid.New()
	suite.projectID = uuid.New()
	suite.environmentID = uuid.New()
	suite.serviceID = uuid.New()
	suite.input = &ExecInput{
		TeamID:        suite.teamID,
		ProjectID:     suite.projectID,
		EnvironmentID: suite.environmentID,
		ServiceID:     suite.serviceID,
	}
}

func (suite *ResolveSuite) expectChainLookups() {
	suite.MockTeamRepo.EXPECT().GetByID(suite.Ctx, suite.teamID).
		Return(&ent.Team{ID: suite.teamID, Namespace: "test-ns"}, nil)
	suite.MockProjectRepo.EXPECT().GetByID(suite.Ctx, suite.projectID).
		Return(&ent.Project{ID: suite.projectID, TeamID: suite.teamID}, nil)
	suite.MockEnvironmentRepo.EXPECT().GetByID(suite.Ctx, suite.environmentID).
		Return(&ent.Environment{ID: suite.environmentID, ProjectID: suite.projectID}, nil)
	suite.MockServiceRepo.EXPECT().GetByID(suite.Ctx, suite.serviceID).
		Return(&ent.Service{ID: suite.serviceID, EnvironmentID: suite.environmentID}, nil)
}

func (suite *ResolveSuite) TestRequiresEditor() {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.userID, mock.MatchedBy(func(checks []permissions_repo.PermissionCheck) bool {
			return len(checks) == 1 &&
				checks[0].Action == schema.ActionEditor &&
				checks[0].ResourceType == schema.ResourceTypeService &&
				checks[0].ResourceID == suite.serviceID
		})).
		Return(errdefs.ErrUnauthorized)

	target, err := suite.service.Resolve(suite.Ctx, suite.userID, "token", suite.input)
	suite.Nil(target)
	suite.ErrorIs(err, errdefs.ErrUnauthorized)
}

func (suite *ResolveSuite) TestNoPodsFound() {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.userID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil)
	suite.expectChainLookups()
	suite.MockK8s.EXPECT().CreateClientWithToken("token").Return(nil, nil)
	suite.MockK8s.EXPECT().
		GetPodsByLabels(suite.Ctx, "test-ns", map[string]string{"unbind-service": suite.serviceID.String()}, nil).
		Return(&corev1.PodList{}, nil)

	target, err := suite.service.Resolve(suite.Ctx, suite.userID, "token", suite.input)
	suite.Nil(target)
	suite.ErrorIs(err, errdefs.ErrNotFound)
}

func (suite *ResolveSuite) TestDefaultsToFirstRunningPod() {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.userID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil)
	suite.expectChainLookups()
	suite.MockK8s.EXPECT().CreateClientWithToken("token").Return(nil, nil)
	suite.MockK8s.EXPECT().
		GetPodsByLabels(suite.Ctx, "test-ns", map[string]string{"unbind-service": suite.serviceID.String()}, nil).
		Return(&corev1.PodList{Items: []corev1.Pod{
			{
				ObjectMeta: metav1.ObjectMeta{Name: "pending-pod"},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app"}}},
				Status:     corev1.PodStatus{Phase: corev1.PodPending},
			},
			{
				ObjectMeta: metav1.ObjectMeta{Name: "running-pod"},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app"}, {Name: "sidecar"}}},
				Status:     corev1.PodStatus{Phase: corev1.PodRunning},
			},
		}}, nil)

	target, err := suite.service.Resolve(suite.Ctx, suite.userID, "token", suite.input)
	suite.Require().NoError(err)
	suite.Equal("running-pod", target.PodName)
	suite.Equal("app", target.Container)
	suite.Equal(defaultShellCommand, target.Command)
}

func (suite *ResolveSuite) TestRejectsUnknownContainer() {
	suite.input.PodName = "running-pod"
	suite.input.Container = "nope"

	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.userID, mock.AnythingOfType("[]permissions_repo.PermissionCheck")).
		Return(nil)
	suite.expectChainLookups()
	suite.MockK8s.EXPECT().CreateClientWithToken("token").Return(nil, nil)
	suite.MockK8s.EXPECT().
		GetPodsByLabels(suite.Ctx, "test-ns", map[string]string{"unbind-service": suite.serviceID.String()}, nil).
		Return(&corev1.PodList{Items: []corev1.Pod{
			{
				ObjectMeta: metav1.ObjectMeta{Name: "running-pod"},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app"}}},
				Status:     corev1.PodStatus{Phase: corev1.PodRunning},
			},
		}}, nil)

	target, err := suite.service.Resolve(suite.Ctx, suite.userID, "token", suite.input)
	suite.Nil(target)
	suite.ErrorIs(err, errdefs.ErrNotFound)
}

func TestResolveSuite(t *testing.T) {
	suite.Run(t, new(ResolveSuite))
}
