package models

import (
	"reflect"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

type PvcScope string

const (
	PvcScopeTeam        PvcScope = "team"
	PvcScopeProject     PvcScope = "project"
	PvcScopeEnvironment PvcScope = "environment"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u PvcScope) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["PvcScope"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "PvcScope")
		schemaRef.Title = "PvcScope"
		schemaRef.Enum = append(schemaRef.Enum,
			[]any{
				string(PvcScopeTeam),
				string(PvcScopeProject),
				string(PvcScopeEnvironment),
			}...)
		r.Map()["PvcScope"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/PvcScope"}
}

// * List
type ListPVCInput struct {
	Type          PvcScope  `query:"type" required:"true"`
	TeamID        uuid.UUID `query:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `query:"project_id" required:"false" format:"uuid"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"false" format:"uuid"`
}

// * Get
type GetPVCInput struct {
	Type          PvcScope  `query:"type" required:"true"`
	TeamID        uuid.UUID `query:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `query:"project_id" required:"false" format:"uuid"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"false" format:"uuid"`
	ID            string    `query:"id" required:"true"`
}

// * Create
type CreatePVCInput struct {
	Type          PvcScope  `json:"type" required:"true"`
	Name          string    `json:"name" required:"true" minLength:"1"`
	Description   *string   `json:"description,omitempty" required:"false"`
	TeamID        uuid.UUID `json:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `json:"project_id" required:"false" format:"uuid"`
	EnvironmentID uuid.UUID `json:"environment_id" required:"false" format:"uuid"`
	CapacityGB    float64   `json:"capacity_gb" required:"true"`
	// Both or neither: attach the new volume to a service in the same environment right away
	ServiceID *uuid.UUID `json:"service_id,omitempty" required:"false" format:"uuid" doc:"Service to attach the volume to, requires mount_path"`
	MountPath *string    `json:"mount_path,omitempty" required:"false" doc:"Path to mount the volume at on the service, requires service_id"`
}

// * Update
type UpdatePVCInput struct {
	Name          *string   `json:"name" required:"false" minLength:"1"`
	Description   *string   `json:"description,omitempty" required:"false"`
	Type          PvcScope  `json:"type" required:"true"`
	TeamID        uuid.UUID `json:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `json:"project_id" required:"false" format:"uuid"`
	EnvironmentID uuid.UUID `json:"environment_id" required:"false" format:"uuid"`
	ID            string    `json:"id" required:"true"`
	CapacityGB    *float64  `json:"capacity_gb" required:"false" doc:"Size of the PVC in GB (e.g., '10')"`
}

// * Delete
type DeletePVCInput struct {
	ID            string    `json:"id" required:"true"`
	Type          PvcScope  `json:"type" required:"true"`
	TeamID        uuid.UUID `json:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `json:"project_id" required:"false" format:"uuid"`
	EnvironmentID uuid.UUID `json:"environment_id" required:"false" format:"uuid"`
}
