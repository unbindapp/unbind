package models

import (
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

const (
	// TeamMemberSourceTeam means the user holds a role on the team itself
	TeamMemberSourceTeam    = "team"
	TeamMemberSourceProject = "project"
	// TeamMemberSourceGroup means the user reaches the team or project through another group, such as superusers
	TeamMemberSourceGroup = "group"
)

type TeamMemberResponse struct {
	UserResponse
	Role      schema.PermittedAction `json:"role" doc:"Strongest role the user holds on the team or project listed"`
	Source    string                 `json:"source" enum:"team,project,group" doc:"team: holds a role on the team. project: holds a role on the project. group: reaches it through another group. A member is managed in the list of what the role is on, so a team member is read-only in a project's list"`
	GroupName *string                `json:"group_name,omitempty" doc:"The group the access comes from, when source is group"`
}

func TransformTeamMember(user *ent.User, role schema.PermittedAction) *TeamMemberResponse {
	return &TeamMemberResponse{
		UserResponse: *TransformUserEntity(user),
		Role:         role,
		Source:       TeamMemberSourceTeam,
	}
}

func TransformProjectMember(user *ent.User, role schema.PermittedAction) *TeamMemberResponse {
	return &TeamMemberResponse{
		UserResponse: *TransformUserEntity(user),
		Role:         role,
		Source:       TeamMemberSourceProject,
	}
}

func TransformInheritedTeamMember(user *ent.User, role schema.PermittedAction, groupName string) *TeamMemberResponse {
	return &TeamMemberResponse{
		UserResponse: *TransformUserEntity(user),
		Role:         role,
		Source:       TeamMemberSourceGroup,
		GroupName:    &groupName,
	}
}
