package models

import "github.com/google/uuid"

type UpdateProjectInput struct {
	TeamID               uuid.UUID  `json:"team_id" format:"uuid" required:"true"`
	ProjectID            uuid.UUID  `json:"project_id" format:"uuid" required:"true"`
	Name                 string     `json:"name" required:"false"`
	Description          *string    `json:"description" required:"false"`
	DefaultEnvironmentID *uuid.UUID `json:"default_environment_id" format:"uuid" required:"false"`
}
