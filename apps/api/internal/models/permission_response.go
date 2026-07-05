package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type PermissionResponse struct {
	ID               uuid.UUID               `json:"id" format:"uuid"`
	Action           schema.PermittedAction  `json:"action"`
	ResourceType     schema.ResourceType     `json:"resource_type"`
	ResourceSelector schema.ResourceSelector `json:"resource_selector"`
	CreatedAt        time.Time               `json:"created_at"`
}

// TransformPermissionEntity transforms an ent.Permission entity into a PermissionResponse
func TransformPermissionEntity(entity *ent.Permission) *PermissionResponse {
	response := &PermissionResponse{}
	if entity != nil {
		response = &PermissionResponse{
			ID:               entity.ID,
			Action:           entity.Action,
			ResourceType:     entity.ResourceType,
			ResourceSelector: entity.ResourceSelector,
			CreatedAt:        entity.CreatedAt,
		}
	}
	return response
}

// TransformPermissionEntities transforms a slice of ent.Permission entities into a slice of PermissionResponse
func TransformPermissionEntities(entities []*ent.Permission) []*PermissionResponse {
	responses := make([]*PermissionResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformPermissionEntity(entity)
	}
	return responses
}
