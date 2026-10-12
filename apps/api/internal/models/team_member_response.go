package models

import (
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

const (
	// TeamMemberSourceTeam means the user holds a role on the team itself
	TeamMemberSourceTeam = "team"
	// TeamMemberSourceGroup means the user reaches the team through another group, such as superusers
	TeamMemberSourceGroup = "group"
)

type TeamMemberResponse struct {
	UserResponse
	Role      schema.PermittedAction `json:"role" doc:"Strongest role the user holds on the team"`
	Source    string                 `json:"source" enum:"team,group" doc:"team: holds a role on the team and can be managed here. group: reaches the team through another group and is read-only here"`
	GroupName *string                `json:"group_name,omitempty" doc:"The group the access comes from, when source is group"`
}

func TransformTeamMember(user *ent.User, role schema.PermittedAction) *TeamMemberResponse {
	return &TeamMemberResponse{
		UserResponse: *TransformUserEntity(user),
		Role:         role,
		Source:       TeamMemberSourceTeam,
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
