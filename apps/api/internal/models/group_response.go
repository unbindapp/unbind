package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

type GroupResponse struct {
	ID          uuid.UUID `json:"id" format:"uuid"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// TransformGroupEntity transforms an ent.Group entity into a GroupResponse
func TransformGroupEntity(entity *ent.Group) *GroupResponse {
	response := &GroupResponse{}
	if entity != nil {
		response = &GroupResponse{
			ID:          entity.ID,
			Name:        entity.Name,
			Description: entity.Description,
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
