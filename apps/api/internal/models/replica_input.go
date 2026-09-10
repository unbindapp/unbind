package models

import (
	"reflect"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

type ReplicaType string

const (
	ReplicaTypeTeam        ReplicaType = "team"
	ReplicaTypeProject     ReplicaType = "project"
	ReplicaTypeEnvironment ReplicaType = "environment"
	ReplicaTypeService     ReplicaType = "service"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u ReplicaType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["ReplicaType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "ReplicaType")
		schemaRef.Title = "ReplicaType"
		schemaRef.Enum = append(schemaRef.Enum, string(ReplicaTypeTeam))
		schemaRef.Enum = append(schemaRef.Enum, string(ReplicaTypeProject))
		schemaRef.Enum = append(schemaRef.Enum, string(ReplicaTypeEnvironment))
		schemaRef.Enum = append(schemaRef.Enum, string(ReplicaTypeService))
		r.Map()["ReplicaType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/ReplicaType"}
}

// ReplicaStatusInput defines the query parameters for getting replica statuses
type ReplicaStatusInput struct {
	Type          ReplicaType `query:"type" required:"true"`
	TeamID        uuid.UUID   `query:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID   `query:"project_id" required:"false" format:"uuid"`
	EnvironmentID uuid.UUID   `query:"environment_id" required:"false" format:"uuid"`
	ServiceID     uuid.UUID   `query:"service_id" required:"false" format:"uuid"`
}

// ReplicaHealthInput defines the query parameters for getting replica health for a service
type ReplicaHealthInput struct {
	TeamID        uuid.UUID `query:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `query:"project_id" required:"true" format:"uuid"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true" format:"uuid"`
	ServiceID     uuid.UUID `query:"service_id" required:"true" format:"uuid"`
}
