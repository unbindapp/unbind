package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type DeploymentInputRequirements interface {
	GetTeamID() uuid.UUID
	GetProjectID() uuid.UUID
	GetServiceID() uuid.UUID
	GetEnvironmentID() uuid.UUID
}

type GetDeploymentBaseInput struct {
	TeamID        uuid.UUID `query:"team_id" required:"true" doc:"The ID of the team"`
	ProjectID     uuid.UUID `query:"project_id" required:"true" doc:"The ID of the project"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true" doc:"The ID of the environment"`
	ServiceID     uuid.UUID `query:"service_id" required:"true" doc:"The ID of the service"`
}

type GetDeploymentsInput struct {
	PaginationParams
	GetDeploymentBaseInput
	Statuses []schema.DeploymentStatus `query:"statuses" required:"false" doc:"Filter by status"`
}

type GetDeploymentByIDInput struct {
	GetDeploymentBaseInput
	DeploymentID uuid.UUID `query:"deployment_id" required:"true" doc:"The ID of the deployment"`
}

func (self *GetDeploymentBaseInput) GetTeamID() uuid.UUID {
	return self.TeamID
}

func (self *GetDeploymentBaseInput) GetProjectID() uuid.UUID {
	return self.ProjectID
}

func (self *GetDeploymentBaseInput) GetServiceID() uuid.UUID {
	return self.ServiceID
}

func (self *GetDeploymentBaseInput) GetEnvironmentID() uuid.UUID {
	return self.EnvironmentID
}

// Triggering build

type CreateDeploymentInput struct {
	TeamID        uuid.UUID `format:"uuid" required:"true" json:"team_id"`
	ProjectID     uuid.UUID `format:"uuid" required:"true" json:"project_id"`
	ServiceID     uuid.UUID `format:"uuid" required:"true" json:"service_id"`
	EnvironmentID uuid.UUID `format:"uuid" required:"true" json:"environment_id"`
	GitSha        *string   `json:"git_sha" required:"false" doc:"The git sha of the deployment"`
}

func (self *CreateDeploymentInput) GetTeamID() uuid.UUID {
	return self.TeamID
}

func (self *CreateDeploymentInput) GetProjectID() uuid.UUID {
	return self.ProjectID
}

func (self *CreateDeploymentInput) GetServiceID() uuid.UUID {
	return self.ServiceID
}

func (self *CreateDeploymentInput) GetEnvironmentID() uuid.UUID {
	return self.EnvironmentID
}

// Re-deploying specific deployment ID
type RedeployExistingDeploymentInput struct {
	TeamID            uuid.UUID `format:"uuid" required:"true" json:"team_id"`
	ProjectID         uuid.UUID `format:"uuid" required:"true" json:"project_id"`
	ServiceID         uuid.UUID `format:"uuid" required:"true" json:"service_id"`
	EnvironmentID     uuid.UUID `format:"uuid" required:"true" json:"environment_id"`
	DeploymentID      uuid.UUID `format:"uuid" required:"true" json:"deployment_id"`
	DisableBuildCache bool      `json:"disable_build_cache" required:"false" doc:"Disable build cache for this redeployment"`
	SmartRedeploy     bool      `json:"smart_redeploy" required:"false" doc:"Try to intelligently redeploy without rebuilding if possible"`
}

func (self *RedeployExistingDeploymentInput) GetTeamID() uuid.UUID {
	return self.TeamID
}

func (self *RedeployExistingDeploymentInput) GetProjectID() uuid.UUID {
	return self.ProjectID
}

func (self *RedeployExistingDeploymentInput) GetServiceID() uuid.UUID {
	return self.ServiceID
}

func (self *RedeployExistingDeploymentInput) GetEnvironmentID() uuid.UUID {
	return self.EnvironmentID
}
