package models

import (
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

type ProjectResponse struct {
	ID                   uuid.UUID              `json:"id"`
	KubernetesName       string                 `json:"kubernetes_name"`
	Name                 string                 `json:"name"`
	Description          *string                `json:"description"`
	Status               string                 `json:"status"`
	TeamID               uuid.UUID              `json:"team_id"`
	CreatedAt            time.Time              `json:"created_at"`
	DefaultEnvironmentID *uuid.UUID             `json:"default_environment_id,omitempty"`
	ServiceCount         int                    `json:"service_count,omitempty"`
	ServiceIcons         []string               `json:"service_icons,omitempty" nullable:"false"`
	Environments         []*EnvironmentResponse `json:"environments" nullable:"false"`
	EnvironmentCount     int                    `json:"environment_count"`
}

func (self *ProjectResponse) AttachServiceSummary(counts map[uuid.UUID]int, providerSummaries map[uuid.UUID][]string) {
	for _, environment := range self.Environments {
		if count, ok := counts[environment.ID]; ok {
			environment.ServiceCount = count
			// Project-level
			self.ServiceCount += count
		}
		if providerSummary, ok := providerSummaries[environment.ID]; ok {
			environment.ServiceIcons = providerSummary
			// Project-level
			self.ServiceIcons = append(self.ServiceIcons, providerSummary...)

			// De-duplicate
			uniqueIcons := make(map[string]struct{})
			for _, icon := range self.ServiceIcons {
				uniqueIcons[icon] = struct{}{}
			}
			self.ServiceIcons = make([]string, len(uniqueIcons))
			i := 0
			for icon := range uniqueIcons {
				self.ServiceIcons[i] = icon
				i++
			}
			slices.Sort(self.ServiceIcons)
		}
	}
}

// TransformProjectEntity transforms an ent.Project entity into a ProjectResponse
func TransformProjectEntity(entity *ent.Project) *ProjectResponse {
	response := &ProjectResponse{}
	if entity != nil {
		response = &ProjectResponse{
			ID:               entity.ID,
			KubernetesName:   entity.KubernetesName,
			Name:             entity.Name,
			Description:      entity.Description,
			Status:           entity.Status,
			TeamID:           entity.TeamID,
			CreatedAt:        entity.CreatedAt,
			Environments:     TransformEnvironmentEntitities(entity.Edges.Environments),
			EnvironmentCount: len(entity.Edges.Environments),
		}
	}
	return response
}

// TransformProjectEntitities transforms a slice of ent.Project entities into a slice of ProjectResponse
func TransformProjectEntitities(entities []*ent.Project) []*ProjectResponse {
	responses := make([]*ProjectResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformProjectEntity(entity)
	}
	return responses
}
