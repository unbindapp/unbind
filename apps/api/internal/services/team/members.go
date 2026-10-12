package team_service

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
)

type TeamMemberAddInput struct {
	TeamID uuid.UUID              `json:"team_id" format:"uuid" required:"true"`
	Email  string                 `json:"email" format:"email" required:"true" doc:"Email of an existing account. Accounts are created by instance admins."`
	Role   schema.PermittedAction `json:"role" required:"true" doc:"admin, editor or viewer on this team"`
}

type TeamMemberRoleInput struct {
	TeamID uuid.UUID              `json:"team_id" format:"uuid" required:"true"`
	UserID uuid.UUID              `json:"user_id" format:"uuid" required:"true"`
	Role   schema.PermittedAction `json:"role" required:"true" doc:"admin, editor or viewer on this team"`
}

type TeamMemberRemoveInput struct {
	TeamID uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	UserID uuid.UUID `json:"user_id" format:"uuid" required:"true"`
}

// ListMembers shows who reaches the team: members holding a role on it, and
// users who reach it through another group, so the list never hides access.
func (self *TeamService) ListMembers(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID) ([]*models.TeamMemberResponse, error) {
	if err := self.checkTeam(ctx, requesterUserID, schema.ActionViewer, teamID); err != nil {
		return nil, err
	}

	roleGroups, err := self.repo.Team().GetRoleGroups(ctx, teamID)
	if err != nil {
		return nil, err
	}
	members := map[uuid.UUID]*models.TeamMemberResponse{}
	for _, group := range roleGroups {
		if group.Role == nil {
			continue
		}
		for _, user := range group.Edges.Users {
			members[user.ID] = models.TransformTeamMember(user, *group.Role)
		}
	}

	reaching, err := self.repo.Team().GetGroupsReachingTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	for _, group := range reaching {
		role := grantedRole(group, teamID)
		for _, user := range group.Edges.Users {
			current, listed := members[user.ID]
			if listed && (current.Source == models.TeamMemberSourceTeam || permissions_repo.StrongerAction(current.Role, role) == current.Role) {
				continue
			}
			members[user.ID] = models.TransformInheritedTeamMember(user, role, group.Name)
		}
	}

	resp := make([]*models.TeamMemberResponse, 0, len(members))
	for _, member := range members {
		resp = append(resp, member)
	}
	slices.SortFunc(resp, func(a, b *models.TeamMemberResponse) int {
		return strings.Compare(a.Email, b.Email)
	})
	return resp, nil
}

func (self *TeamService) AddMember(ctx context.Context, requesterUserID uuid.UUID, input *TeamMemberAddInput) (*models.TeamMemberResponse, error) {
	if err := validateMemberRole(input.Role); err != nil {
		return nil, err
	}
	if err := self.checkTeam(ctx, requesterUserID, schema.ActionAdmin, input.TeamID); err != nil {
		return nil, err
	}

	user, err := self.repo.User().GetByEmail(ctx, strings.TrimSpace(strings.ToLower(input.Email)))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "No account with that email")
		}
		return nil, err
	}

	roleGroups, err := self.repo.Team().GetRoleGroups(ctx, input.TeamID)
	if err != nil {
		return nil, err
	}
	if current := groupHoldingUser(roleGroups, user.ID); current != nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeConflict, "User is already a member of this team")
	}
	target := roleGroup(roleGroups, input.Role)
	if target == nil {
		return nil, fmt.Errorf("team %s has no %s role group", input.TeamID, input.Role)
	}

	if err := self.repo.Group().AddUser(ctx, target.ID, user.ID); err != nil {
		return nil, err
	}
	return models.TransformTeamMember(user, input.Role), nil
}

func (self *TeamService) UpdateMemberRole(ctx context.Context, requesterUserID uuid.UUID, input *TeamMemberRoleInput) (*models.TeamMemberResponse, error) {
	if err := validateMemberRole(input.Role); err != nil {
		return nil, err
	}
	if err := self.checkTeam(ctx, requesterUserID, schema.ActionAdmin, input.TeamID); err != nil {
		return nil, err
	}

	roleGroups, err := self.repo.Team().GetRoleGroups(ctx, input.TeamID)
	if err != nil {
		return nil, err
	}
	current := groupHoldingUser(roleGroups, input.UserID)
	if current == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "User is not a member of this team")
	}
	user := userIn(current, input.UserID)
	if *current.Role == input.Role {
		return models.TransformTeamMember(user, input.Role), nil
	}
	target := roleGroup(roleGroups, input.Role)
	if target == nil {
		return nil, fmt.Errorf("team %s has no %s role group", input.TeamID, input.Role)
	}

	if err := self.repo.Group().AddUser(ctx, target.ID, input.UserID); err != nil {
		return nil, err
	}
	if err := self.repo.Group().RemoveUser(ctx, current.ID, input.UserID); err != nil {
		return nil, err
	}
	return models.TransformTeamMember(user, input.Role), nil
}

// RemoveMember takes a team admin, or the member leaving on their own.
func (self *TeamService) RemoveMember(ctx context.Context, requesterUserID uuid.UUID, input *TeamMemberRemoveInput) error {
	if requesterUserID != input.UserID {
		if err := self.checkTeam(ctx, requesterUserID, schema.ActionAdmin, input.TeamID); err != nil {
			return err
		}
	}

	roleGroups, err := self.repo.Team().GetRoleGroups(ctx, input.TeamID)
	if err != nil {
		return err
	}
	current := groupHoldingUser(roleGroups, input.UserID)
	if current == nil {
		return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "User is not a member of this team")
	}
	return self.repo.Group().RemoveUser(ctx, current.ID, input.UserID)
}

func (self *TeamService) checkTeam(ctx context.Context, requesterUserID uuid.UUID, action schema.PermittedAction, teamID uuid.UUID) error {
	return self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{
			Action:       action,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	})
}

func validateMemberRole(role schema.PermittedAction) error {
	if slices.Contains(team_repo.MemberRoles, role) {
		return nil
	}
	return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Role must be admin, editor or viewer")
}

func groupHoldingUser(groups []*ent.Group, userID uuid.UUID) *ent.Group {
	for _, group := range groups {
		if group.Role != nil && userIn(group, userID) != nil {
			return group
		}
	}
	return nil
}

func userIn(group *ent.Group, userID uuid.UUID) *ent.User {
	for _, user := range group.Edges.Users {
		if user.ID == userID {
			return user
		}
	}
	return nil
}

// grantedRole is the strongest role a group's team grants give on the team.
func grantedRole(group *ent.Group, teamID uuid.UUID) schema.PermittedAction {
	var best schema.PermittedAction
	for _, p := range group.Edges.Permissions {
		if p.ResourceType != schema.ResourceTypeTeam {
			continue
		}
		if p.ResourceSelector.Superuser || p.ResourceSelector.ID == teamID {
			best = permissions_repo.StrongerAction(best, p.Action)
		}
	}
	return best
}
