package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type VariableReferenceInputItem struct {
	Name    string                           `json:"name" doc:"The name of the target variable" required:"true"`
	Value   string                           `json:"value" doc:"The template for the value of the variable reference, e.g. 'https://${source_kubernetes_name.key}'" required:"true"`
	Sources []schema.VariableReferenceSource `json:"sources" doc:"The sources to reference in the template interpolation" nullable:"false"`
}

type ResolveVariableReferenceInput struct {
	TeamID     uuid.UUID                          `query:"team_id"`
	Type       schema.VariableReferenceType       `query:"type"`
	Name       string                             `query:"name"`
	SourceType schema.VariableReferenceSourceType `query:"source_type"`
	SourceID   uuid.UUID                          `query:"source_id"`
	Key        string                             `query:"key"`
}
