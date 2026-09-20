package project_service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/services"
	"k8s.io/client-go/kubernetes"
)

type CreateProjectSuite struct {
	services.ServiceTestSuite
	service *ProjectService
	userID  uuid.UUID
	teamID  uuid.UUID
}

func (suite *CreateProjectSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &ProjectService{repo: suite.MockRepo, k8s: suite.MockK8s}
	suite.userID = uuid.New()
	suite.teamID = uuid.New()

	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.userID, mock.Anything).Return(nil).Once()
}

func (suite *CreateProjectSuite) TestRejectsTakenName() {
	suite.MockTeamRepo.EXPECT().GetByID(suite.Ctx, suite.teamID).Return(&ent.Team{ID: suite.teamID, Namespace: "team-ns"}, nil).Once()
	suite.MockK8s.EXPECT().GetInternalClient().Return(&kubernetes.Clientset{})
	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		RunAndReturn(func(ctx context.Context, fn func(repository.TxInterface) error) error {
			return fn(suite.NewTxMockTyped())
		}).
		Once()
	suite.MockProjectRepo.EXPECT().GetNamesByTeam(suite.Ctx, mock.Anything, suite.teamID).Return([]string{"First Project"}, nil).Once()

	result, err := suite.service.CreateProject(suite.Ctx, suite.userID, &CreateProjectInput{TeamID: suite.teamID, Name: " First Project "})

	suite.ErrorIs(err, errdefs.ErrConflict)
	suite.ErrorContains(err, `A project named "First Project" already exists in this team`)
	suite.Nil(result)
}

func (suite *CreateProjectSuite) TestRejectsNameThatIsEmptyOnceTrimmed() {
	result, err := suite.service.CreateProject(suite.Ctx, suite.userID, &CreateProjectInput{TeamID: suite.teamID, Name: "   "})

	suite.ErrorIs(err, errdefs.ErrInvalidInput)
	suite.Nil(result)
}

func TestCreateProjectSuite(t *testing.T) {
	suite.Run(t, new(CreateProjectSuite))
}
