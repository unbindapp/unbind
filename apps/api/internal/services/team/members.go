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
	TeamID    uuid.UUID              `json:"team_id" format:"uuid" required:"true"`
	ProjectID *uuid.UUID             `json:"project_id,omitempty" format:"uuid" required:"false" doc:"Set to give the role on this project of the team only"`
	Email     string                 `json:"email" format:"email" required:"true" doc:"Email of an existing account. Accounts are created by instance admins."`
	Role      schema.PermittedAction `json:"role" required:"true" doc:"admin, editor or viewer on this team or project"`
}

type TeamMemberRoleInput struct {
	TeamID    uuid.UUID              `json:"team_id" format:"uuid" required:"true"`
	ProjectID *uuid.UUID             `json:"project_id,omitempty" format:"uuid" required:"false" doc:"Set to change the role held on this project of the team"`
	UserID    uuid.UUID              `json:"user_id" format:"uuid" required:"true"`
	Role      schema.PermittedAction `json:"role" required:"true" doc:"admin, editor or viewer on this team or project"`
}

type TeamMemberRemoveInput struct {
	TeamID    uuid.UUID  `json:"team_id" format:"uuid" required:"true"`
	ProjectID *uuid.UUID `json:"project_id,omitempty" format:"uuid" required:"false" doc:"Set to remove the role held on this project of the team"`
	UserID    uuid.UUID  `json:"user_id" format:"uuid" required:"true"`
}

// ListMembers shows who reaches the team or project: members holding a role on
// it, and users who reach it through another group, so the list never hides access.
func (self *TeamService) ListMembers(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID, projectID *uuid.UUID) ([]*models.TeamMemberResponse, error) {
	if _, err := self.authorize(ctx, requesterUserID, schema.ActionViewer, teamID, projectID); err != nil {
		return nil, err
	}

	roleGroups, err := self.roleGroups(ctx, teamID, projectID)
	if err != nil {
		return nil, err
	}
	members := map[uuid.UUID]*models.TeamMemberResponse{}
	for _, group := range roleGroups {
		if group.Role == nil {
			continue
		}
		for _, user := range group.Edges.Users {
			members[user.ID] = directMember(user, *group.Role, projectID)
		}
	}

	reaching, err := self.groupsReaching(ctx, teamID, projectID)
	if err != nil {
		return nil, err
	}
	scope := team_repo.MemberScope{TeamID: teamID, ProjectID: projectID}
	for _, group := range reaching {
		role := grantedRole(group, scope)
		for _, user := range group.Edges.Users {
			current, listed := members[user.ID]
			if listed && (current.Source == directSource(projectID) || permissions_repo.StrongerAction(current.Role, role) == current.Role) {
				continue
			}
			members[user.ID] = inheritedMember(user, role, group, teamID)
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
	project, err := self.authorize(ctx, requesterUserID, schema.ActionAdmin, input.TeamID, input.ProjectID)
	if err != nil {
		return nil, err
	}

	user, err := self.repo.User().GetByEmail(ctx, strings.TrimSpace(strings.ToLower(input.Email)))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "No account with that email")
		}
		return nil, err
	}

	roleGroups, err := self.roleGroupsToJoin(ctx, input.TeamID, project)
	if err != nil {
		return nil, err
	}
	if current := groupHoldingUser(roleGroups, user.ID); current != nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeConflict, fmt.Sprintf("User is already a member of this %s", scopeNoun(input.ProjectID)))
	}
	target := roleGroup(roleGroups, input.Role)
	if target == nil {
		return nil, missingRoleGroup(input.TeamID, input.ProjectID, input.Role)
	}

	if err := self.repo.Group().AddUser(ctx, target.ID, user.ID); err != nil {
		return nil, err
	}
	return directMember(user, input.Role, input.ProjectID), nil
}

func (self *TeamService) UpdateMemberRole(ctx context.Context, requesterUserID uuid.UUID, input *TeamMemberRoleInput) (*models.TeamMemberResponse, error) {
	if err := validateMemberRole(input.Role); err != nil {
		return nil, err
	}
	if _, err := self.authorize(ctx, requesterUserID, schema.ActionAdmin, input.TeamID, input.ProjectID); err != nil {
		return nil, err
	}

	roleGroups, err := self.roleGroups(ctx, input.TeamID, input.ProjectID)
	if err != nil {
		return nil, err
	}
	current := groupHoldingUser(roleGroups, input.UserID)
	if current == nil {
		return nil, notAMember(input.ProjectID)
	}
	user := userIn(current, input.UserID)
	if *current.Role == input.Role {
		return directMember(user, input.Role, input.ProjectID), nil
	}
	target := roleGroup(roleGroups, input.Role)
	if target == nil {
		return nil, missingRoleGroup(input.TeamID, input.ProjectID, input.Role)
	}

	if err := self.repo.Group().AddUser(ctx, target.ID, input.UserID); err != nil {
		return nil, err
	}
	if err := self.repo.Group().RemoveUser(ctx, current.ID, input.UserID); err != nil {
		return nil, err
	}
	return directMember(user, input.Role, input.ProjectID), nil
}

// RemoveMember takes an admin of the team or project, or the member leaving on their own.
func (self *TeamService) RemoveMember(ctx context.Context, requesterUserID uuid.UUID, input *TeamMemberRemoveInput) error {
	if requesterUserID != input.UserID {
		if _, err := self.authorize(ctx, requesterUserID, schema.ActionAdmin, input.TeamID, input.ProjectID); err != nil {
			return err
		}
	}

	roleGroups, err := self.roleGroups(ctx, input.TeamID, input.ProjectID)
	if err != nil {
		return err
	}
	current := groupHoldingUser(roleGroups, input.UserID)
	if current == nil {
		return notAMember(input.ProjectID)
	}
	return self.repo.Group().RemoveUser(ctx, current.ID, input.UserID)
}

func (self *TeamService) authorize(ctx context.Context, requesterUserID uuid.UUID, action schema.PermittedAction, teamID uuid.UUID, projectID *uuid.UUID) (*ent.Project, error) {
	if projectID == nil {
		return nil, self.checkTeam(ctx, requesterUserID, action, teamID)
	}

	err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{
			Action:       action,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   *projectID,
		},
	})
	if err != nil {
		return nil, err
	}

	project, err := self.repo.Project().GetByID(ctx, *projectID)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	if err != nil || project.TeamID != teamID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
	}
	return project, nil
}

func (self *TeamService) roleGroups(ctx context.Context, teamID uuid.UUID, projectID *uuid.UUID) ([]*ent.Group, error) {
	if projectID == nil {
		return self.repo.Team().GetRoleGroups(ctx, teamID)
	}
	return self.repo.Team().GetProjectRoleGroups(ctx, *projectID)
}

func (self *TeamService) roleGroupsToJoin(ctx context.Context, teamID uuid.UUID, project *ent.Project) ([]*ent.Group, error) {
	if project == nil {
		return self.repo.Team().GetRoleGroups(ctx, teamID)
	}
	return self.repo.Team().EnsureProjectRoleGroups(ctx, nil, project)
}

func (self *TeamService) groupsReaching(ctx context.Context, teamID uuid.UUID, projectID *uuid.UUID) ([]*ent.Group, error) {
	if projectID == nil {
		return self.repo.Team().GetGroupsReachingTeam(ctx, teamID)
	}
	return self.repo.Team().GetGroupsReachingProject(ctx, teamID, *projectID)
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

// grantedRole is the strongest role a group's grants give on the team or project.
func grantedRole(group *ent.Group, scope team_repo.MemberScope) schema.PermittedAction {
	var best schema.PermittedAction
	for _, grant := range group.Edges.Permissions {
		if scope.ReachedBy(grant) {
			best = permissions_repo.StrongerAction(best, grant.Action)
		}
	}
	return best
}

func directSource(projectID *uuid.UUID) string {
	if projectID == nil {
		return models.TeamMemberSourceTeam
	}
	return models.TeamMemberSourceProject
}

func directMember(user *ent.User, role schema.PermittedAction, projectID *uuid.UUID) *models.TeamMemberResponse {
	if projectID == nil {
		return models.TransformTeamMember(user, role)
	}
	return models.TransformProjectMember(user, role)
}

func inheritedMember(user *ent.User, role schema.PermittedAction, group *ent.Group, teamID uuid.UUID) *models.TeamMemberResponse {
	isRoleGroupOfTheTeam := group.TeamID != nil && *group.TeamID == teamID
	if isRoleGroupOfTheTeam {
		return models.TransformTeamMember(user, role)
	}
	return models.TransformInheritedTeamMember(user, role, group.Name)
}

func scopeNoun(projectID *uuid.UUID) string {
	if projectID == nil {
		return "team"
	}
	return "project"
}

func notAMember(projectID *uuid.UUID) error {
	return errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("User is not a member of this %s", scopeNoun(projectID)))
}

func missingRoleGroup(teamID uuid.UUID, projectID *uuid.UUID, role schema.PermittedAction) error {
	if projectID == nil {
		return fmt.Errorf("team %s has no %s role group", teamID, role)
	}
	return fmt.Errorf("project %s has no %s role group", *projectID, role)
}
