package models

import (
	"github.com/google/uuid"
)

type VariableUpsertInput struct {
	Name  string `json:"name" required:"true"`
	Value string `json:"value" required:"true" doc:"May contain ${{source.KEY}} references"`
}

// ChangeSetVariables holds the staged variable changes for one scope
type ChangeSetVariables struct {
	BaseVariablesJSONInput
	Upserts []VariableUpsertInput `json:"upserts,omitempty" doc:"Variables to create or update"`
	Deletes []string              `json:"deletes,omitempty" doc:"Variables to remove"`
}

type ApplyChangesInput struct {
	DryRun    bool                  `json:"dry_run,omitempty" doc:"Validate the changes and report the affected services without applying anything"`
	Variables []ChangeSetVariables  `json:"variables,omitempty" doc:"Variable changes grouped by scope"`
	Services  []*UpdateServiceInput `json:"services,omitempty" doc:"Config changes, one entry per service"`
}

type ChangeAction string

const (
	// ChangeActionBuild rebuilds the service from source before deploying
	ChangeActionBuild ChangeAction = "build"
	// ChangeActionRedeploy creates a new deployment from the current image
	ChangeActionRedeploy ChangeAction = "redeploy"
	// ChangeActionRestart restarts the pods so they pick up new secret values
	ChangeActionRestart ChangeAction = "restart"
	// ChangeActionNone changes config only, the next deployment picks it up
	ChangeActionNone ChangeAction = "none"
)

type ChangeReason string

const (
	ChangeReasonConfig    ChangeReason = "config"
	ChangeReasonVariables ChangeReason = "variables"
	ChangeReasonReference ChangeReason = "reference"
)

type AffectedService struct {
	ServiceID    uuid.UUID      `json:"service_id" format:"uuid"`
	Name         string         `json:"name"`
	Action       ChangeAction   `json:"action" enum:"build,redeploy,restart,none"`
	Reasons      []ChangeReason `json:"reasons" nullable:"false" doc:"Why the service is affected: its config, its own variables, or variables it references"`
	DeploymentID *uuid.UUID     `json:"deployment_id,omitempty" format:"uuid" doc:"The deployment created for the service, when one was created immediately"`
}

// ChangeFailure reports a change that could not be applied. Changes not listed here were applied.
type ChangeFailure struct {
	ServiceID *uuid.UUID              `json:"service_id,omitempty" format:"uuid" doc:"Set when a service config change failed"`
	Variables *BaseVariablesJSONInput `json:"variables,omitempty" doc:"Set when a variable change failed"`
	Message   string                  `json:"message"`
}

type ApplyChangesResponse struct {
	DryRun   bool              `json:"dry_run"`
	Affected []AffectedService `json:"affected" nullable:"false"`
	Failures []ChangeFailure   `json:"failures" nullable:"false"`
}
