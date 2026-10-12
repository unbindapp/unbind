package team_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
)

type MembersSuite struct {
	services.ServiceTestSuite
	service   *TeamService
	adminID   uuid.UUID
	teamID    uuid.UUID
	member    *ent.User
	groups    []*ent.Group
	adminGrp  *ent.Group
	editorGrp *ent.Group
}

func (suite *MembersSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &TeamService{repo: suite.MockRepo, k8s: suite.MockK8s}
	suite.adminID = uuid.New()
	suite.teamID = uuid.New()
	suite.member = &ent.User{ID: uuid.New(), Email: "dev@example.com"}

	suite.groups = make([]*ent.Group, 0, 3)
	for _, role := range []schema.PermittedAction{schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer} {
		suite.groups = append(suite.groups, &ent.Group{ID: uuid.New(), Name: "team-acme-" + string(role), TeamID: &suite.teamID, Role: new(role)})
	}
	suite.adminGrp, suite.editorGrp = suite.groups[0], suite.groups[1]
	suite.editorGrp.Edges.Users = []*ent.User{suite.member}
}

func (suite *MembersSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *MembersSuite) expectCheck(action schema.PermittedAction, result error) {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.adminID, []permissions_repo.PermissionCheck{{Action: action, ResourceType: schema.ResourceTypeTeam, ResourceID: suite.teamID}}).
		Return(result).Once()
}

func (suite *MembersSuite) TestAddMemberNeedsTeamAdmin() {
	suite.expectCheck(schema.ActionAdmin, errdefs.ErrUnauthorized)

	_, err := suite.service.AddMember(suite.Ctx, suite.adminID, &TeamMemberAddInput{TeamID: suite.teamID, Email: "new@example.com", Role: schema.ActionViewer})
	suite.ErrorIs(err, errdefs.ErrUnauthorized)
}

func (suite *MembersSuite) TestAddMemberRejectsUnknownRoleBeforeLookups() {
	_, err := suite.service.AddMember(suite.Ctx, suite.adminID, &TeamMemberAddInput{TeamID: suite.teamID, Email: "new@example.com", Role: "owner"})
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
}

func (suite *MembersSuite) TestAddMemberPutsUserInRoleGroupOnce() {
	suite.expectCheck(schema.ActionAdmin, nil)
	suite.MockUserRepo.EXPECT().GetByEmail(suite.Ctx, "dev@example.com").Return(suite.member, nil).Once()
	suite.MockTeamRepo.EXPECT().GetRoleGroups(suite.Ctx, suite.teamID).Return(suite.groups, nil).Once()

	_, err := suite.service.AddMember(suite.Ctx, suite.adminID, &TeamMemberAddInput{TeamID: suite.teamID, Email: " Dev@Example.com ", Role: schema.ActionAdmin})
	suite.ErrorIs(err, errdefs.ErrConflict)

	newcomer := &ent.User{ID: uuid.New(), Email: "new@example.com"}
	suite.expectCheck(schema.ActionAdmin, nil)
	suite.MockUserRepo.EXPECT().GetByEmail(suite.Ctx, "new@example.com").Return(newcomer, nil).Once()
	suite.MockTeamRepo.EXPECT().GetRoleGroups(suite.Ctx, suite.teamID).Return(suite.groups, nil).Once()
	suite.MockGroupRepo.EXPECT().AddUser(suite.Ctx, suite.adminGrp.ID, newcomer.ID).Return(nil).Once()

	added, err := suite.service.AddMember(suite.Ctx, suite.adminID, &TeamMemberAddInput{TeamID: suite.teamID, Email: "new@example.com", Role: schema.ActionAdmin})
	suite.Require().NoError(err)
	suite.Equal(schema.ActionAdmin, added.Role)
	suite.Equal(models.TeamMemberSourceTeam, added.Source)
}

func (suite *MembersSuite) TestUpdateRoleMovesBetweenRoleGroups() {
	suite.expectCheck(schema.ActionAdmin, nil)
	suite.MockTeamRepo.EXPECT().GetRoleGroups(suite.Ctx, suite.teamID).Return(suite.groups, nil).Once()
	suite.MockGroupRepo.EXPECT().AddUser(suite.Ctx, suite.adminGrp.ID, suite.member.ID).Return(nil).Once()
	suite.MockGroupRepo.EXPECT().RemoveUser(suite.Ctx, suite.editorGrp.ID, suite.member.ID).Return(nil).Once()

	updated, err := suite.service.UpdateMemberRole(suite.Ctx, suite.adminID, &TeamMemberRoleInput{TeamID: suite.teamID, UserID: suite.member.ID, Role: schema.ActionAdmin})
	suite.Require().NoError(err)
	suite.Equal(schema.ActionAdmin, updated.Role)
}

func (suite *MembersSuite) TestRemoveSelfNeedsNoAdmin() {
	suite.MockTeamRepo.EXPECT().GetRoleGroups(suite.Ctx, suite.teamID).Return(suite.groups, nil).Once()
	suite.MockGroupRepo.EXPECT().RemoveUser(suite.Ctx, suite.editorGrp.ID, suite.member.ID).Return(nil).Once()

	err := suite.service.RemoveMember(suite.Ctx, suite.member.ID, &TeamMemberRemoveInput{TeamID: suite.teamID, UserID: suite.member.ID})
	suite.NoError(err)
}

func (suite *MembersSuite) TestListMembersShowsInheritedAccessWithoutOverridingDirectRoles() {
	root := &ent.User{ID: uuid.New(), Email: "root@example.com"}
	superusers := &ent.Group{Name: "superuser"}
	superusers.Edges.Users = []*ent.User{root, suite.member}
	superusers.Edges.Permissions = []*ent.Permission{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{Superuser: true}}}

	suite.expectCheck(schema.ActionViewer, nil)
	suite.MockTeamRepo.EXPECT().GetRoleGroups(suite.Ctx, suite.teamID).Return(suite.groups, nil).Once()
	suite.MockTeamRepo.EXPECT().GetGroupsReachingTeam(suite.Ctx, suite.teamID).Return([]*ent.Group{superusers}, nil).Once()

	members, err := suite.service.ListMembers(suite.Ctx, suite.adminID, suite.teamID)
	suite.Require().NoError(err)
	suite.Require().Len(members, 2)

	suite.Equal("dev@example.com", members[0].Email)
	suite.Equal(schema.ActionEditor, members[0].Role)
	suite.Equal(models.TeamMemberSourceTeam, members[0].Source)

	suite.Equal("root@example.com", members[1].Email)
	suite.Equal(schema.ActionAdmin, members[1].Role)
	suite.Equal(models.TeamMemberSourceGroup, members[1].Source)
	suite.Equal("superuser", *members[1].GroupName)
}

func TestMembersSuite(t *testing.T) {
	suite.Run(t, new(MembersSuite))
}

var _ = mock.Anything
