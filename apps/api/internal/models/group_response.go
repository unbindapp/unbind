package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type GroupResponse struct {
	ID          uuid.UUID               `json:"id" format:"uuid"`
	Name        string                  `json:"name"`
	Description string                  `json:"description"`
	TeamID      *uuid.UUID              `json:"team_id,omitempty" format:"uuid" doc:"Set when the group is a role group owned by a team; such groups are managed through the team's members"`
	Role        *schema.PermittedAction `json:"role,omitempty" doc:"The role a team role group grants on its team"`
	CreatedAt   time.Time               `json:"created_at"`
}

// TransformGroupEntity transforms an ent.Group entity into a GroupResponse
func TransformGroupEntity(entity *ent.Group) *GroupResponse {
	response := &GroupResponse{}
	if entity != nil {
		response = &GroupResponse{
			ID:          entity.ID,
			Name:        entity.Name,
			Description: entity.Description,
			TeamID:      entity.TeamID,
			Role:        entity.Role,
			CreatedAt:   entity.CreatedAt,
		}
	}
	return response
}

// TransformGroupEntities transforms a slice of ent.Group entities into a slice of GroupResponse
func TransformGroupEntities(entities []*ent.Group) []*GroupResponse {
	responses := make([]*GroupResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformGroupEntity(entity)
	}
	return responses
}
