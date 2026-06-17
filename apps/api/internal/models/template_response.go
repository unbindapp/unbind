package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type TemplateShortResponse struct {
	ID                      uuid.UUID                              `json:"id"`
	DisplayRank             uint                                   `json:"display_rank"`
	ResourceRecommendations schema.TemplateResourceRecommendations `json:"resource_recommendations,omitempty"`
	Name                    string                                 `json:"name"`
	Icon                    string                                 `json:"icon"`
	Keywords                []string                               `json:"keywords" nullable:"false"`
	Description             string                                 `json:"description"`
	Version                 int                                    `json:"version"`
	Immutable               bool                                   `json:"immutable"`
	CreatedAt               time.Time                              `json:"created_at"`
}

// TransformTemplateShortEntity transforms an ent.Template entity into a TemplateResponse
func TransformTemplateShortEntity(entity *ent.Template) *TemplateShortResponse {
	response := &TemplateShortResponse{}
	if entity != nil {
		if entity.Keywords == nil {
			entity.Keywords = []string{}
		}
		response = &TemplateShortResponse{
			ID:                      entity.ID,
			DisplayRank:             entity.DisplayRank,
			Name:                    entity.Name,
			Icon:                    entity.Icon,
			ResourceRecommendations: entity.ResourceRecommendations,
			Keywords:                entity.Keywords,
			Description:             entity.Description,
			Version:                 entity.Version,
			Immutable:               entity.Immutable,
			CreatedAt:               entity.CreatedAt,
		}
	}
	return response
}

// TransformTemplateShortEntities transforms a slice of ent.Template entities into a slice of TemplateResponse
func TransformTemplateShortEntities(entities []*ent.Template) []*TemplateShortResponse {
	responses := make([]*TemplateShortResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformTemplateShortEntity(entity)
	}
	return responses
}

// TemplateWithDefinitionResponse is the response model for a template with its definition
type TemplateWithDefinitionResponse struct {
	ID                      uuid.UUID                              `json:"id"`
	DisplayRank             uint                                   `json:"display_rank"`
	Name                    string                                 `json:"name"`
	Icon                    string                                 `json:"icon"`
	Keywords                []string                               `json:"keywords" nullable:"false"`
	Description             string                                 `json:"description"`
	Version                 int                                    `json:"version"`
	ResourceRecommendations schema.TemplateResourceRecommendations `json:"resource_recommendations,omitempty"`
	Immutable               bool                                   `json:"immutable"`
	Definition              schema.TemplateDefinition              `json:"definition"`
	CreatedAt               time.Time                              `json:"created_at"`
}

// TransformTemplateEntity transforms an ent.Template entity into a TemplateWithDefinitionResponse
func TransformTemplateEntity(entity *ent.Template) *TemplateWithDefinitionResponse {
	response := &TemplateWithDefinitionResponse{}
	for i := range entity.Definition.Services {
		// Remove initDB script if present
		if entity.Definition.Services[i].DatabaseConfig != nil {
			entity.Definition.Services[i].InitDBReplacers = nil
			entity.Definition.Services[i].DatabaseConfig.InitDB = ""
		}

		if entity.Definition.Services[i].VariableReferences == nil {
			entity.Definition.Services[i].VariableReferences = []schema.TemplateVariableReference{}
		}
		if entity.Definition.Services[i].Variables == nil {
			entity.Definition.Services[i].Variables = []schema.TemplateVariable{}
		}
		if entity.Definition.Services[i].VariablesMounts == nil {
			entity.Definition.Services[i].VariablesMounts = []*schema.VariableMount{}
		}
		if entity.Definition.Services[i].Volumes == nil {
			entity.Definition.Services[i].Volumes = []schema.TemplateVolume{}
		}
		if entity.Definition.Services[i].DependsOn == nil {
			entity.Definition.Services[i].DependsOn = []string{}
		}
		if entity.Definition.Services[i].InputIDs == nil {
			entity.Definition.Services[i].InputIDs = []string{}
		}
		if entity.Definition.Services[i].Ports == nil {
			entity.Definition.Services[i].Ports = []schema.PortSpec{}
		}
		if entity.Definition.Services[i].ProtectedVariables == nil {
			entity.Definition.Services[i].ProtectedVariables = []string{}
		}
		entity.Definition.Services[i].Icon = resolveTemplateServiceIcon(entity.Definition.Services[i])
	}
	if entity != nil {
		if entity.Keywords == nil {
			entity.Keywords = []string{}
		}
		response = &TemplateWithDefinitionResponse{
			ID:                      entity.ID,
			DisplayRank:             entity.DisplayRank,
			Name:                    entity.Name,
			Icon:                    entity.Icon,
			Keywords:                entity.Keywords,
			Description:             entity.Description,
			Version:                 entity.Version,
			ResourceRecommendations: entity.ResourceRecommendations,
			Definition:              entity.Definition,
			Immutable:               entity.Immutable,
			CreatedAt:               entity.CreatedAt,
		}
	}
	return response
}

// TransformTemplateEntities transforms a slice of ent.Template entities into a slice of TemplateWithDefinitionResponse
func TransformTemplateEntities(entities []*ent.Template) []*TemplateWithDefinitionResponse {
	responses := make([]*TemplateWithDefinitionResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformTemplateEntity(entity)
	}
	return responses
}

// Helper
func resolveTemplateServiceIcon(service schema.TemplateService) string {
	switch service.Type {
	case schema.ServiceTypeDatabase:
		if service.DatabaseType == nil {
			return string(service.Type)
		}
		return string(*service.DatabaseType)
	default:
		return string(service.Type)
	}
}
