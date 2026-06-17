package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

// Base inputs
type BaseVariablesInput struct {
	Type          schema.VariableReferenceSourceType `query:"type" required:"true" doc:"The type of variable"`
	TeamID        uuid.UUID                          `query:"team_id" required:"true"`
	ProjectID     uuid.UUID                          `query:"project_id" doc:"If present, fetch project variables"`
	EnvironmentID uuid.UUID                          `query:"environment_id" doc:"If present, fetch environment variables - requires project_id"`
	ServiceID     uuid.UUID                          `query:"service_id" doc:"If present, fetch service variables - requires project_id and environment_id"`
}

type BaseVariablesJSONInput struct {
	Type          schema.VariableReferenceSourceType `json:"type" required:"true" doc:"The type of variable"`
	TeamID        uuid.UUID                          `json:"team_id" required:"true"`
	ProjectID     uuid.UUID                          `json:"project_id" required:"false" doc:"If present without environment_id, mutate team variables"`
	EnvironmentID uuid.UUID                          `json:"environment_id" required:"false" doc:"If present without service_id, mutate environment variables - requires project_id"`
	ServiceID     uuid.UUID                          `json:"service_id" required:"false" doc:"If present, mutate service variables - requires project_id and environment_id"`
}
