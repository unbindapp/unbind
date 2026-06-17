package models

import (
	"reflect"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

type MetricsType string

const (
	MetricsTypeTeam        MetricsType = "team"
	MetricsTypeProject     MetricsType = "project"
	MetricsTypeEnvironment MetricsType = "environment"
	MetricsTypeService     MetricsType = "service"
)

var MetricsTypeValues = []MetricsType{
	MetricsTypeTeam,
	MetricsTypeProject,
	MetricsTypeEnvironment,
	MetricsTypeService,
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u MetricsType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["MetricsType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "MetricsType")
		schemaRef.Title = "MetricsType"
		for _, v := range MetricsTypeValues {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["MetricsType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/MetricsType"}
}

// MetricsQueryInput defines the query parameters for prometheus
type MetricsQueryInput struct {
	Type          MetricsType `query:"type" required:"true"`
	TeamID        uuid.UUID   `query:"team_id" required:"true"`
	ProjectID     uuid.UUID   `query:"project_id" required:"false"`
	EnvironmentID uuid.UUID   `query:"environment_id" required:"false"`
	ServiceID     uuid.UUID   `query:"service_id" required:"false"`
	Start         time.Time   `query:"start" required:"false" doc:"Start time for the query, defaults to 1 week ago"`
	End           time.Time   `query:"end" required:"false" doc:"End time for the query, defaults to now"`
}

// MetricsVolumeQueryInput defines the query parameters for prometheus PVC queries
type MetricsVolumeQueryInput struct {
	TeamID uuid.UUID `query:"team_id" required:"true"`
	PVCID  string    `query:"pvc_id" required:"true"`
	Start  time.Time `query:"start" required:"false" doc:"Start time for the query, defaults to 1 week ago"`
	End    time.Time `query:"end" required:"false" doc:"End time for the query, defaults to now"`
}
