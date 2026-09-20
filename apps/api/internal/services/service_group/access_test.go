package servicegroup_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/services"
)

// The caller is only checked against the environment in the request, so a group has to
// belong to that environment before anything is done to it.
type GroupAccessSuite struct {
	services.ServiceTestSuite
	service       *ServiceGroupService
	userID        uuid.UUID
	teamID        uuid.UUID
	projectID     uuid.UUID
	environmentID uuid.UUID
	foreignGroup  *ent.ServiceGroup
}

func (suite *GroupAccessSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &ServiceGroupService{repo: suite.MockRepo, k8s: suite.MockK8s}
	suite.userID = uuid.New()
	suite.teamID = uuid.New()
	suite.projectID = uuid.New()
	suite.environmentID = uuid.New()
	suite.foreignGroup = &ent.ServiceGroup{ID: uuid.New(), Name: "theirs", EnvironmentID: uuid.New()}

	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.userID, mock.Anything).Return(nil).Once()
	suite.MockEnvironmentRepo.EXPECT().GetByID(suite.Ctx, suite.environmentID).Return(&ent.Environment{
		ID: suite.environmentID,
		Edges: ent.EnvironmentEdges{Project: &ent.Project{
			ID:    suite.projectID,
			Edges: ent.ProjectEdges{Team: &ent.Team{ID: suite.teamID}},
		}},
	}, nil).Once()
	suite.MockServiceGroupRepo.EXPECT().GetByID(suite.Ctx, suite.foreignGroup.ID).Return(suite.foreignGroup, nil).Once()
}

func (suite *GroupAccessSuite) TestUpdateRejectsGroupOfAnotherEnvironment() {
	result, err := suite.service.UpdateServiceGroup(suite.Ctx, suite.userID, &models.UpdateServiceGroupInput{
		ID:            suite.foreignGroup.ID,
		TeamID:        suite.teamID,
		ProjectID:     suite.projectID,
		EnvironmentID: suite.environmentID,
		Name:          new("mine now"),
	})

	suite.ErrorIs(err, errdefs.ErrNotFound)
	suite.Nil(result)
}

func (suite *GroupAccessSuite) TestDeleteRejectsGroupOfAnotherEnvironment() {
	err := suite.service.DeleteServiceGroup(suite.Ctx, suite.userID, &models.DeleteServiceGroupInput{
		ID:             suite.foreignGroup.ID,
		TeamID:         suite.teamID,
		ProjectID:      suite.projectID,
		EnvironmentID:  suite.environmentID,
		DeleteServices: true,
	})

	suite.ErrorIs(err, errdefs.ErrNotFound)
}

func TestGroupAccessSuite(t *testing.T) {
	suite.Run(t, new(GroupAccessSuite))
}
