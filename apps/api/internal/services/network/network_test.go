package network_service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/services"
)

type countingSyncer struct {
	calls int
}

func (s *countingSyncer) Sync(context.Context) error {
	s.calls++
	return nil
}

type NetworkSuite struct {
	services.ServiceTestSuite
	service *NetworkService
	syncer  *countingSyncer
}

func (suite *NetworkSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.syncer = &countingSyncer{}
	suite.service = NewNetworkService(suite.MockRepo, suite.syncer)
}

func (suite *NetworkSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func serviceInTeam(teamID uuid.UUID) *ent.Service {
	return &ent.Service{
		ID: uuid.New(),
		Edges: ent.ServiceEdges{Environment: &ent.Environment{Edges: ent.EnvironmentEdges{
			Project: &ent.Project{TeamID: teamID, Edges: ent.ProjectEdges{Team: &ent.Team{ID: teamID}}},
		}}},
	}
}

func (suite *NetworkSuite) TestNeedsSystemAdmin() {
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, uuid.Nil, mock.Anything).Return(errdefs.ErrUnauthorized).Once()

	_, err := suite.service.CreateException(suite.Ctx, uuid.Nil, &models.CreateNetworkExceptionInput{TargetServiceID: uuid.New()})
	suite.ErrorIs(err, errdefs.ErrUnauthorized)
	suite.Zero(suite.syncer.calls)
}

func (suite *NetworkSuite) TestRejectsAnExceptionWithinOneTeam() {
	teamID := uuid.New()
	source := serviceInTeam(teamID)
	target := serviceInTeam(teamID)
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, uuid.Nil, mock.Anything).Return(nil).Once()
	suite.MockSystemRepo.EXPECT().GetServiceWithTeam(suite.Ctx, target.ID).Return(target, nil).Once()
	suite.MockSystemRepo.EXPECT().GetServiceWithTeam(suite.Ctx, source.ID).Return(source, nil).Once()

	_, err := suite.service.CreateException(suite.Ctx, uuid.Nil, &models.CreateNetworkExceptionInput{SourceServiceID: &source.ID, TargetServiceID: target.ID})
	suite.ErrorContains(err, "same team")
	suite.Zero(suite.syncer.calls)
}

func (suite *NetworkSuite) TestRejectsAMissingTarget() {
	targetID := uuid.New()
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, uuid.Nil, mock.Anything).Return(nil).Once()
	suite.MockSystemRepo.EXPECT().GetServiceWithTeam(suite.Ctx, targetID).Return(nil, &ent.NotFoundError{}).Once()

	_, err := suite.service.CreateException(suite.Ctx, uuid.Nil, &models.CreateNetworkExceptionInput{TargetServiceID: targetID})
	suite.ErrorContains(err, "Target service not found")
}

func (suite *NetworkSuite) TestRejectsADuplicate() {
	target := serviceInTeam(uuid.New())
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, uuid.Nil, mock.Anything).Return(nil).Once()
	suite.MockSystemRepo.EXPECT().GetServiceWithTeam(suite.Ctx, target.ID).Return(target, nil).Once()
	suite.MockSystemRepo.EXPECT().NetworkExceptionExists(suite.Ctx, (*uuid.UUID)(nil), target.ID).Return(true, nil).Once()

	_, err := suite.service.CreateException(suite.Ctx, uuid.Nil, &models.CreateNetworkExceptionInput{TargetServiceID: target.ID})
	suite.ErrorContains(err, "already exists")
}

func (suite *NetworkSuite) TestCreatesACrossTeamExceptionAndAppliesIt() {
	source := serviceInTeam(uuid.New())
	target := serviceInTeam(uuid.New())
	created := &ent.NetworkException{ID: uuid.New(), SourceServiceID: &source.ID, TargetServiceID: target.ID, Edges: ent.NetworkExceptionEdges{SourceService: source, TargetService: target}}
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, uuid.Nil, mock.Anything).Return(nil).Once()
	suite.MockSystemRepo.EXPECT().GetServiceWithTeam(suite.Ctx, target.ID).Return(target, nil).Once()
	suite.MockSystemRepo.EXPECT().GetServiceWithTeam(suite.Ctx, source.ID).Return(source, nil).Once()
	suite.MockSystemRepo.EXPECT().NetworkExceptionExists(suite.Ctx, &source.ID, target.ID).Return(false, nil).Once()
	suite.MockSystemRepo.EXPECT().CreateNetworkException(suite.Ctx, &source.ID, target.ID).Return(created, nil).Once()

	exception, err := suite.service.CreateException(suite.Ctx, uuid.Nil, &models.CreateNetworkExceptionInput{SourceServiceID: &source.ID, TargetServiceID: target.ID})
	suite.Require().NoError(err)
	suite.Equal(source.ID, exception.Source.ID)
	suite.Equal(target.ID, exception.Target.ID)
	suite.Equal(1, suite.syncer.calls)
}

func TestNetworkSuite(t *testing.T) {
	suite.Run(t, new(NetworkSuite))
}
