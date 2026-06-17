package models

import (
	"reflect"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
)

type LogType string

const (
	LogTypeTeam        LogType = "team"
	LogTypeProject     LogType = "project"
	LogTypeEnvironment LogType = "environment"
	LogTypeService     LogType = "service"
	LogTypeBuild       LogType = "build"
	LogTypeDeployment  LogType = "deployment"
)

var LogTypeValues = []LogType{
	LogTypeTeam,
	LogTypeProject,
	LogTypeEnvironment,
	LogTypeService,
	LogTypeDeployment,
	LogTypeBuild,
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u LogType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["LogType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "LogType")
		schemaRef.Title = "LogType"
		for _, v := range LogTypeValues {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["LogType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/LogType"}
}

// LogStreamInput defines the query parameters for log streaming
type LogStreamInput struct {
	Type          LogType   `query:"type" required:"true"`
	TeamID        uuid.UUID `query:"team_id" required:"true"`
	ProjectID     uuid.UUID `query:"project_id" required:"false"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"false"`
	ServiceID     uuid.UUID `query:"service_id" required:"false"`
	DeploymentID  uuid.UUID `query:"deployment_id" required:"false"`
	Start         time.Time `query:"start"`
	Since         string    `query:"since" default:"10m" doc:"Duration to look back (e.g., '1h', '30m')"`
	Limit         int64     `query:"limit" default:"100" doc:"Number of lines to get from the end"`
	Timestamps    bool      `query:"timestamps" default:"true" doc:"Include timestamps in logs"`
	Filters       string    `query:"filters" doc:"Optional logql filter string"`
}

// LogQueryInput defines the query parameters for log fetching
type LogQueryInput struct {
	Type          LogType            `query:"type" required:"true"`
	TeamID        uuid.UUID          `query:"team_id" required:"true"`
	ProjectID     uuid.UUID          `query:"project_id" required:"false"`
	EnvironmentID uuid.UUID          `query:"environment_id" required:"false"`
	ServiceID     uuid.UUID          `query:"service_id" required:"false"`
	DeploymentID  uuid.UUID          `query:"deployment_id" required:"false"`
	Filters       string             `query:"filters" doc:"Optional logql filter string"`
	Start         time.Time          `query:"start" doc:"Start time for the query"`
	End           time.Time          `query:"end" doc:"End time for the query"`
	Since         string             `query:"since" doc:"Duration to look back (e.g., '1h', '30m')"`
	Limit         int                `query:"limit" doc:"Number of log lines to get"`
	Direction     loki.LokiDirection `query:"direction" doc:"Direction of the logs (forward or backward)"`
}
