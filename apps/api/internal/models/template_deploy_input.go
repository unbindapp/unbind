package models

import "github.com/google/uuid"

// For template inputs specifically
type TemplateInputValue struct {
	ID    string `json:"id"`
	Value string `json:"value"`
}

type TemplateDeployInput struct {
	GroupName        string               `json:"group_name" required:"true" minLength:"1"`
	GroupDescription *string              `json:"group_description,omitempty" required:"false"`
	TemplateID       uuid.UUID            `json:"template_id" format:"uuid" required:"true"`
	TeamID           uuid.UUID            `json:"team_id" format:"uuid" required:"true"`
	ProjectID        uuid.UUID            `json:"project_id" format:"uuid" required:"true"`
	EnvironmentID    uuid.UUID            `json:"environment_id" format:"uuid" required:"true"`
	Inputs           []TemplateInputValue `json:"inputs,omitempty" required:"false"`
}
