package deployments_service_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/services"
	deployments_service "github.com/unbindapp/unbind-api/internal/services/deployments"
)

// A deployment id is only honored for the service the caller is checked against
type DeploymentAccessSuite struct {
	services.ServiceTestSuite
	service *deployments_service.DeploymentService
	userID  uuid.UUID
	base    models.GetDeploymentBaseInput
	other   *ent.Deployment
}

func (suite *DeploymentAccessSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = deployments_service.NewDeploymentService(suite.MockRepo, suite.MockK8s, nil, nil, nil, nil, nil)
	suite.userID = uuid.New()
	suite.base = models.GetDeploymentBaseInput{TeamID: uuid.New(), ProjectID: uuid.New(), EnvironmentID: uuid.New(), ServiceID: uuid.New()}
	suite.other = &ent.Deployment{ID: uuid.New(), ServiceID: uuid.New()}

	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.userID, mock.Anything).Return(nil)
	suite.MockTeamRepo.EXPECT().GetByID(suite.Ctx, suite.base.TeamID).Return(&ent.Team{ID: suite.base.TeamID, Edges: ent.TeamEdges{Projects: []*ent.Project{{
		ID:    suite.base.ProjectID,
		Edges: ent.ProjectEdges{Environments: []*ent.Environment{{ID: suite.base.EnvironmentID}}},
	}}}}, nil)
	suite.MockServiceRepo.EXPECT().GetByID(suite.Ctx, suite.base.ServiceID).Return(&ent.Service{ID: suite.base.ServiceID, EnvironmentID: suite.base.EnvironmentID}, nil)
	suite.MockDeploymentRepo.EXPECT().GetByID(suite.Ctx, suite.other.ID).Return(suite.other, nil)
}

func (suite *DeploymentAccessSuite) TestAnotherServicesDeploymentIsNotFound() {
	_, err := suite.service.GetDeploymentByID(suite.Ctx, suite.userID, &models.GetDeploymentByIDInput{GetDeploymentBaseInput: suite.base, DeploymentID: suite.other.ID})
	suite.ErrorIs(err, errdefs.ErrNotFound)

	_, err = suite.service.CreateRedeployment(suite.Ctx, suite.userID, &models.RedeployExistingDeploymentInput{
		TeamID: suite.base.TeamID, ProjectID: suite.base.ProjectID, EnvironmentID: suite.base.EnvironmentID, ServiceID: suite.base.ServiceID,
		DeploymentID: suite.other.ID, SmartRedeploy: true,
	})
	suite.ErrorIs(err, errdefs.ErrNotFound)
}

func TestDeploymentAccessSuite(t *testing.T) {
	suite.Run(t, new(DeploymentAccessSuite))
}
