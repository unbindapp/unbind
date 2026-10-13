package models

import (
	"reflect"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

type CronRunStatus string

const (
	CronRunStatusRunning   CronRunStatus = "running"
	CronRunStatusSucceeded CronRunStatus = "succeeded"
	CronRunStatusFailed    CronRunStatus = "failed"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u CronRunStatus) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["CronRunStatus"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "CronRunStatus")
		schemaRef.Title = "CronRunStatus"
		schemaRef.Enum = append(schemaRef.Enum, string(CronRunStatusRunning))
		schemaRef.Enum = append(schemaRef.Enum, string(CronRunStatusSucceeded))
		schemaRef.Enum = append(schemaRef.Enum, string(CronRunStatusFailed))
		r.Map()["CronRunStatus"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/CronRunStatus"}
}

// CronRunResponse is one run of a service with a cron schedule
type CronRunResponse struct {
	Name          string        `json:"name" doc:"Name of the run, use it to find its logs"`
	Status        CronRunStatus `json:"status"`
	Manual        bool          `json:"manual" doc:"Started by hand instead of by the schedule"`
	DeploymentID  *uuid.UUID    `json:"deployment_id,omitempty" format:"uuid" doc:"Deployment the run used"`
	CreatedAt     time.Time     `json:"created_at"`
	StartedAt     *time.Time    `json:"started_at,omitempty"`
	CompletedAt   *time.Time    `json:"completed_at,omitempty" doc:"When the run finished, succeeded or failed"`
	FailureReason string        `json:"failure_reason,omitempty"`
}

type CronRunServiceInput struct {
	TeamID        uuid.UUID `query:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `query:"project_id" required:"true" format:"uuid"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true" format:"uuid"`
	ServiceID     uuid.UUID `query:"service_id" required:"true" format:"uuid"`
}
