package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

type EnvironmentResponse struct {
	ID             uuid.UUID `json:"id"`
	KubernetesName string    `json:"kubernetes_name"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	Active         bool      `json:"active"`
	ServiceCount   int       `json:"service_count,omitempty"`
	ServiceIcons   []string  `json:"service_icons,omitempty" nullable:"false"`
	CreatedAt      time.Time `json:"created_at"`
}

// TransformEnvironmentEntity transforms an ent.Environment entity into an EnvironmentResponse
func TransformEnvironmentEntity(entity *ent.Environment) *EnvironmentResponse {
	response := &EnvironmentResponse{}
	if entity != nil {
		description := ""
		if entity.Description != nil {
			description = *entity.Description
		}
		response = &EnvironmentResponse{
			ID:             entity.ID,
			KubernetesName: entity.KubernetesName,
			Name:           entity.Name,
			Description:    description,
			Active:         entity.Active,
			CreatedAt:      entity.CreatedAt,
			ServiceIcons:   []string{},
		}
	}
	return response
}

// Transforms a slice of ent.Environment entities into a slice of EnvironmentResponse
func TransformEnvironmentEntitities(entities []*ent.Environment) []*EnvironmentResponse {
	responses := make([]*EnvironmentResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformEnvironmentEntity(entity)
	}
	return responses
}
