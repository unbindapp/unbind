package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

type NetworkServiceResponse struct {
	ID              uuid.UUID `json:"id" format:"uuid"`
	Name            string    `json:"name"`
	TeamID          uuid.UUID `json:"team_id" format:"uuid"`
	TeamName        string    `json:"team_name"`
	ProjectID       uuid.UUID `json:"project_id" format:"uuid"`
	ProjectName     string    `json:"project_name"`
	EnvironmentID   uuid.UUID `json:"environment_id" format:"uuid"`
	EnvironmentName string    `json:"environment_name"`
}

type NetworkExceptionResponse struct {
	ID        uuid.UUID               `json:"id" format:"uuid"`
	Source    *NetworkServiceResponse `json:"source,omitempty" required:"false" doc:"The service allowed to connect, empty when every source is allowed"`
	Target    *NetworkServiceResponse `json:"target"`
	CreatedAt time.Time               `json:"created_at"`
}

type CreateNetworkExceptionInput struct {
	SourceServiceID *uuid.UUID `json:"source_service_id" required:"false" format:"uuid" doc:"Service allowed to connect, omit to accept connections from every source, including servers and hosts outside the cluster"`
	TargetServiceID uuid.UUID  `json:"target_service_id" format:"uuid" doc:"Service that accepts the connections"`
}

type DeleteNetworkExceptionInput struct {
	ID uuid.UUID `json:"id" format:"uuid"`
}

type UpdateNetworkSettingsInput struct {
	TeamNetworkIsolation bool `json:"team_network_isolation" doc:"Whether services only accept connections from their own team, the system and network exceptions"`
}

type NetworkSettingsResponse struct {
	TeamNetworkIsolation bool                        `json:"team_network_isolation"`
	Exceptions           []*NetworkExceptionResponse `json:"exceptions" nullable:"false"`
}

func TransformNetworkServiceEntity(entity *ent.Service) *NetworkServiceResponse {
	if entity == nil {
		return nil
	}
	response := &NetworkServiceResponse{
		ID:            entity.ID,
		Name:          entity.Name,
		EnvironmentID: entity.EnvironmentID,
	}
	environment := entity.Edges.Environment
	if environment == nil {
		return response
	}
	response.EnvironmentName = environment.Name
	response.ProjectID = environment.ProjectID
	if environment.Edges.Project == nil {
		return response
	}
	response.ProjectName = environment.Edges.Project.Name
	response.TeamID = environment.Edges.Project.TeamID
	if environment.Edges.Project.Edges.Team != nil {
		response.TeamName = environment.Edges.Project.Edges.Team.Name
	}
	return response
}

func TransformNetworkServiceEntities(entities []*ent.Service) []*NetworkServiceResponse {
	responses := make([]*NetworkServiceResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformNetworkServiceEntity(entity)
	}
	return responses
}

func TransformNetworkExceptionEntity(entity *ent.NetworkException) *NetworkExceptionResponse {
	return &NetworkExceptionResponse{
		ID:        entity.ID,
		Source:    TransformNetworkServiceEntity(entity.Edges.SourceService),
		Target:    TransformNetworkServiceEntity(entity.Edges.TargetService),
		CreatedAt: entity.CreatedAt,
	}
}

func TransformNetworkExceptionEntities(entities []*ent.NetworkException) []*NetworkExceptionResponse {
	responses := make([]*NetworkExceptionResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformNetworkExceptionEntity(entity)
	}
	return responses
}
