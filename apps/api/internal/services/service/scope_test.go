package service_service_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/services"
	service_service "github.com/unbindapp/unbind-api/internal/services/service"
)

// The body's team, project and environment have to be the service's own, since
// they scope the host conflict check, the mountable volumes and the webhooks
type UpdateScopeSuite struct {
	services.ServiceTestSuite
}

func (suite *UpdateScopeSuite) TestAnotherEnvironmentsIdsAreRefused() {
	svc := service_service.NewServiceService(nil, suite.MockRepo, nil, suite.MockK8s, nil, nil, nil, nil, nil, nil)
	userID, teamID, projectID, environmentID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	service := &ent.Service{ID: uuid.New(), EnvironmentID: uuid.New()}
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, userID, mock.Anything).Return(nil)
	suite.MockEnvironmentRepo.EXPECT().GetByID(suite.Ctx, environmentID).Return(&ent.Environment{
		ID:    environmentID,
		Edges: ent.EnvironmentEdges{Project: &ent.Project{ID: projectID, Edges: ent.ProjectEdges{Team: &ent.Team{ID: teamID}}}},
	}, nil)
	suite.MockServiceRepo.EXPECT().GetByID(suite.Ctx, service.ID).Return(service, nil)

	_, err := svc.UpdateService(suite.Ctx, userID, &models.UpdateServiceInput{
		TeamID: teamID, ProjectID: projectID, EnvironmentID: environmentID, ServiceID: service.ID,
		UpsertHosts: []schema.HostSpec{{Host: "app.victim.example", Path: "/api"}},
	})

	suite.ErrorIs(err, errdefs.ErrNotFound)
	suite.MockServiceRepo.AssertNotCalled(suite.T(), "CountHostConflicts", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestUpdateScopeSuite(t *testing.T) {
	suite.Run(t, new(UpdateScopeSuite))
}
