package models

import "github.com/google/uuid"

type CreateServiceGroupInput struct {
	Name          string    `json:"name" required:"true" doc:"The name of the service group" minLength:"1"`
	Icon          *string   `json:"icon,omitempty" required:"false" doc:"The icon of the service group"`
	Description   *string   `json:"description,omitempty" required:"false" doc:"The description of the service group"`
	TeamID        uuid.UUID `json:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `json:"project_id" required:"true" format:"uuid"`
	EnvironmentID uuid.UUID `json:"environment_id" required:"true" format:"uuid"`
}

type UpdateServiceGroupInput struct {
	ID               uuid.UUID   `json:"id" required:"true" format:"uuid"`
	Name             *string     `json:"name" required:"false" doc:"The name of the service group" minLength:"1"`
	Icon             *string     `json:"icon,omitempty" required:"false" doc:"The icon of the service group"`
	Description      *string     `json:"description,omitempty" required:"false" doc:"The description of the service group"`
	TeamID           uuid.UUID   `json:"team_id" required:"true" format:"uuid"`
	ProjectID        uuid.UUID   `json:"project_id" required:"true" format:"uuid"`
	EnvironmentID    uuid.UUID   `json:"environment_id" required:"true" format:"uuid"`
	AddServiceIDs    []uuid.UUID `json:"add_service_ids" required:"false" doc:"The IDs of the services to add to the service group" format:"uuid"`
	RemoveServiceIDs []uuid.UUID `json:"remove_service_ids" required:"false" doc:"The IDs of the services to remove from the service group" format:"uuid"`
}

type DeleteServiceGroupInput struct {
	ID             uuid.UUID `json:"id" required:"true" doc:"The ID of the service group" format:"uuid"`
	TeamID         uuid.UUID `json:"team_id" required:"true" doc:"The ID of the team" format:"uuid"`
	ProjectID      uuid.UUID `json:"project_id" required:"true" doc:"The ID of the project" format:"uuid"`
	EnvironmentID  uuid.UUID `json:"environment_id" required:"true" doc:"The ID of the environment" format:"uuid"`
	DeleteServices bool      `json:"delete_services" required:"false" doc:"Whether to delete the services in the service group"`
}

type GetServiceGroupInput struct {
	ID            uuid.UUID `json:"id" query:"id" required:"true" doc:"The ID of the service group" format:"uuid"`
	TeamID        uuid.UUID `json:"team_id" query:"team_id" required:"true" doc:"The ID of the team" format:"uuid"`
	ProjectID     uuid.UUID `json:"project_id" query:"project_id" required:"true" doc:"The ID of the project" format:"uuid"`
	EnvironmentID uuid.UUID `json:"environment_id" query:"environment_id" required:"true" doc:"The ID of the environment" format:"uuid"`
}

type ListServiceGroupsInput struct {
	TeamID        uuid.UUID `json:"team_id" query:"team_id" required:"true" doc:"The ID of the team" format:"uuid"`
	ProjectID     uuid.UUID `json:"project_id" query:"project_id" required:"true" doc:"The ID of the project" format:"uuid"`
	EnvironmentID uuid.UUID `json:"environment_id" query:"environment_id" required:"true" doc:"The ID of the environment" format:"uuid"`
}
