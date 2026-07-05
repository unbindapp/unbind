package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type TeamResponse struct {
	ID             uuid.UUID                `json:"id" format:"uuid"`
	KubernetesName string                   `json:"kubernetes_name"`
	Name           string                   `json:"name"`
	Description    *string                  `json:"description"`
	CreatedAt      time.Time                `json:"created_at"`
	Permissions    []schema.PermittedAction `json:"permissions" nullable:"false" doc:"Actions the current user can perform on this resource"`
}

// TransformTeamEntity transforms an ent.Team entity into a TeamResponse
func TransformTeamEntity(entity *ent.Team) *TeamResponse {
	response := &TeamResponse{}
	if entity != nil {
		response = &TeamResponse{
			ID:             entity.ID,
			KubernetesName: entity.KubernetesName,
			Name:           entity.Name,
			Description:    entity.Description,
			CreatedAt:      entity.CreatedAt,
			Permissions:    []schema.PermittedAction{},
		}
	}
	return response
}

// TransformTeamEntities transforms a slice of ent.Team entities into a slice of TeamResponse
func TransformTeamEntities(entities []*ent.Team) []*TeamResponse {
	responses := make([]*TeamResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformTeamEntity(entity)
	}
	return responses
}
