package team_service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
)

type CreateTeamSuite struct {
	services.ServiceTestSuite
	service *TeamService
	userID  uuid.UUID
}

func (suite *CreateTeamSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &TeamService{repo: suite.MockRepo, k8s: suite.MockK8s}
	suite.userID = uuid.New()
}

func (suite *CreateTeamSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *CreateTeamSuite) TestNeedsSystemAdmin() {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.userID, []permissions_repo.PermissionCheck{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem}}).
		Return(errdefs.ErrUnauthorized).Once()

	_, err := suite.service.CreateTeam(suite.Ctx, suite.userID, &CreateTeamInput{Name: "Acme"})
	suite.ErrorIs(err, errdefs.ErrUnauthorized)
}

func (suite *CreateTeamSuite) TestRemovesNamespaceWhenTheRowFails() {
	client := &kubernetes.Clientset{}
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.userID, mock.Anything).Return(nil).Once()
	suite.MockK8s.EXPECT().GetInternalClient().Return(client).Once()
	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		RunAndReturn(func(ctx context.Context, fn func(repository.TxInterface) error) error {
			return fn(suite.NewTxMockTyped())
		}).Once()
	suite.MockTeamRepo.EXPECT().GetNames(suite.Ctx, mock.Anything).Return([]string{"Default"}, nil).Once()
	suite.MockK8s.EXPECT().CreateNamespace(suite.Ctx, mock.MatchedBy(func(ns string) bool { return len(ns) > len("acme-") && ns[:5] == "acme-" }), client).Return(&corev1.Namespace{}, nil).Once()
	suite.MockK8s.EXPECT().GetOrCreateSecret(suite.Ctx, mock.Anything, mock.Anything, client).Return(nil, false, errors.New("secret failed")).Once()
	suite.MockK8s.EXPECT().DeleteNamespace(suite.Ctx, mock.Anything, client).Return(nil).Once()

	_, err := suite.service.CreateTeam(suite.Ctx, suite.userID, &CreateTeamInput{Name: "Acme"})
	suite.ErrorContains(err, "secret failed")
}

func (suite *CreateTeamSuite) TestRejectsTakenName() {
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.userID, mock.Anything).Return(nil).Once()
	suite.MockK8s.EXPECT().GetInternalClient().Return(&kubernetes.Clientset{}).Once()
	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		RunAndReturn(func(ctx context.Context, fn func(repository.TxInterface) error) error {
			return fn(suite.NewTxMockTyped())
		}).Once()
	suite.MockTeamRepo.EXPECT().GetNames(suite.Ctx, mock.Anything).Return([]string{"Acme"}, nil).Once()

	_, err := suite.service.CreateTeam(suite.Ctx, suite.userID, &CreateTeamInput{Name: " Acme "})
	suite.ErrorIs(err, errdefs.ErrConflict)
}

func TestCreateTeamSuite(t *testing.T) {
	suite.Run(t, new(CreateTeamSuite))
}
