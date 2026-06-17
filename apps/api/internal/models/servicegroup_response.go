package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

type ServiceGroupResponse struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Icon          *string   `json:"icon,omitempty"`
	Description   *string   `json:"description,omitempty"`
	EnvironmentID uuid.UUID `json:"environment_id"`
	CreatedAt     time.Time `json:"created_at"`
}

// TransformServiceGroupEntity transforms an ent.ServiceGroup entity into a ServiceGroupResponse
func TransformServiceGroupEntity(entity *ent.ServiceGroup) *ServiceGroupResponse {
	response := &ServiceGroupResponse{}
	if entity != nil {
		response = &ServiceGroupResponse{
			ID:            entity.ID,
			Name:          entity.Name,
			Icon:          entity.Icon,
			Description:   entity.Description,
			EnvironmentID: entity.EnvironmentID,
			CreatedAt:     entity.CreatedAt,
		}
	}
	return response
}

// TransformServiceGroupEntities transforms a slice of ent.ServiceGroup entities into a slice of ServiceGroupResponse
func TransformServiceGroupEntities(entities []*ent.ServiceGroup) []*ServiceGroupResponse {
	responses := make([]*ServiceGroupResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformServiceGroupEntity(entity)
	}
	return responses
}
