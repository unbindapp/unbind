package group_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/services"
)

type ManagedGroupSuite struct {
	services.ServiceTestSuite
	service *GroupService
	userID  uuid.UUID
	group   *ent.Group
}

func (suite *ManagedGroupSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &GroupService{repo: suite.MockRepo}
	suite.userID = uuid.New()
	teamID := uuid.New()
	suite.group = &ent.Group{ID: uuid.New(), Name: "team-acme-admin", TeamID: &teamID}
	suite.MockGroupRepo.EXPECT().GetByID(suite.Ctx, suite.group.ID).Return(suite.group, nil)
}

func (suite *ManagedGroupSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

// A team's role groups are refused by every group mutation before any permission check runs.
func (suite *ManagedGroupSuite) TestRoleGroupsAreRefused() {
	_, err := suite.service.UpdateGroup(suite.Ctx, suite.userID, suite.group.ID, GroupCreateInput{Name: "renamed"})
	suite.ErrorIs(err, errdefs.ErrInvalidInput)

	suite.ErrorIs(suite.service.DeleteGroup(suite.Ctx, suite.userID, suite.group.ID), errdefs.ErrInvalidInput)
	suite.ErrorIs(suite.service.AddUserToGroup(suite.Ctx, suite.userID, uuid.New(), suite.group.ID), errdefs.ErrInvalidInput)
	suite.ErrorIs(suite.service.RemoveUserFromGroup(suite.Ctx, suite.userID, uuid.New(), suite.group.ID), errdefs.ErrInvalidInput)
	suite.ErrorIs(suite.service.RevokePermissionFromGroup(suite.Ctx, suite.userID, suite.group.ID, uuid.New()), errdefs.ErrInvalidInput)

	_, err = suite.service.GrantPermissionToGroup(suite.Ctx, suite.userID, suite.group.ID, "admin", "team", ent.Permission{}.ResourceSelector)
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
}

func TestManagedGroupSuite(t *testing.T) {
	suite.Run(t, new(ManagedGroupSuite))
}
