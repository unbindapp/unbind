package group_service

import (
	"context"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
)

type MembershipSuite struct {
	services.ServiceTestSuite
	service   *GroupService
	requester uuid.UUID
	target    uuid.UUID
	group     *ent.Group
}

func (suite *MembershipSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &GroupService{repo: suite.MockRepo}
	suite.requester = uuid.New()
	suite.target = uuid.New()
	suite.group = &ent.Group{ID: uuid.New(), Name: "ops"}
	suite.MockGroupRepo.EXPECT().GetByID(suite.Ctx, suite.group.ID).Return(suite.group, nil)
}

func (suite *MembershipSuite) allow(checks ...permissions_repo.PermissionCheck) {
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requester, mock.Anything).RunAndReturn(func(_ context.Context, _ uuid.UUID, asked []permissions_repo.PermissionCheck) error {
		if slices.Contains(checks, asked[0]) {
			return nil
		}
		return errdefs.ErrUnauthorized
	})
}

func (suite *MembershipSuite) TestSystemEditorCannotJoinTheSuperuserGroup() {
	suite.allow(permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeSystem, ResourceID: suite.group.ID})
	suite.MockGroupRepo.EXPECT().GetPermissions(suite.Ctx, suite.group.ID).Return([]*ent.Permission{
		{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem, ResourceSelector: schema.ResourceSelector{Superuser: true}},
	}, nil)

	suite.ErrorIs(suite.service.AddUserToGroup(suite.Ctx, suite.requester, suite.requester, suite.group.ID), errdefs.ErrUnauthorized)
	suite.ErrorIs(suite.service.RemoveUserFromGroup(suite.Ctx, suite.requester, suite.target, suite.group.ID), errdefs.ErrUnauthorized)
	suite.MockGroupRepo.AssertNotCalled(suite.T(), "AddUser", mock.Anything, mock.Anything, mock.Anything)
	suite.MockGroupRepo.AssertNotCalled(suite.T(), "RemoveUser", mock.Anything, mock.Anything, mock.Anything)
}

func (suite *MembershipSuite) TestSystemEditorAddsToAGroupWhoseGrantsTheyHold() {
	teamID := uuid.New()
	suite.allow(
		permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeSystem, ResourceID: suite.group.ID},
		permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeTeam, ResourceID: teamID},
	)
	suite.MockGroupRepo.EXPECT().GetPermissions(suite.Ctx, suite.group.ID).Return([]*ent.Permission{
		{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{ID: teamID}},
	}, nil)
	suite.MockGroupRepo.EXPECT().HasUserWithID(suite.Ctx, suite.group.ID, suite.target).Return(false, nil)
	suite.MockGroupRepo.EXPECT().AddUser(suite.Ctx, suite.group.ID, suite.target).Return(nil)

	suite.NoError(suite.service.AddUserToGroup(suite.Ctx, suite.requester, suite.target, suite.group.ID))
}

func (suite *MembershipSuite) TestSystemAdminSkipsTheGrantComparison() {
	suite.allow(
		permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeSystem, ResourceID: suite.group.ID},
		permissions_repo.PermissionCheck{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem, ResourceID: suite.group.ID},
	)
	suite.MockGroupRepo.EXPECT().HasUserWithID(suite.Ctx, suite.group.ID, suite.target).Return(false, nil)
	suite.MockGroupRepo.EXPECT().AddUser(suite.Ctx, suite.group.ID, suite.target).Return(nil)

	suite.NoError(suite.service.AddUserToGroup(suite.Ctx, suite.requester, suite.target, suite.group.ID))
	suite.MockGroupRepo.AssertNotCalled(suite.T(), "GetPermissions", mock.Anything, mock.Anything)
}

func TestMembershipSuite(t *testing.T) {
	suite.Run(t, new(MembershipSuite))
}
