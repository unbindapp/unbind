package variables_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

// List all
type ListReferenceableVariablesInput struct {
	server.BaseAuthInput
	TeamID        uuid.UUID `query:"team_id" required:"true"`
	ProjectID     uuid.UUID `query:"project_id" required:"true"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true"`
	ServiceID     uuid.UUID `query:"service_id" required:"true"`
}

type ReferenceableVariablesResponse struct {
	Body struct {
		Data []models.AvailableVariableReference `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListReferenceableVariables(ctx context.Context, input *ListReferenceableVariablesInput) (*ReferenceableVariablesResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	// Get team variables
	references, err := self.srv.VariablesService.GetAvailableVariableReferences(ctx, user.ID, bearerToken, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ReferenceableVariablesResponse{}
	resp.Body.Data = references
	return resp, nil
}

// Resolve
type ResolveAvailableVariableReferenceInput struct {
	server.BaseAuthInput
	models.ResolveVariableReferenceInput
}

type ResolveAvailableVariableReferenceResponse struct {
	Body struct {
		Data string `json:"data"`
	}
}

func (self *HandlerGroup) ResolveAvailableVariableReference(ctx context.Context, input *ResolveAvailableVariableReferenceInput) (*ResolveAvailableVariableReferenceResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	resolved, err := self.srv.VariablesService.ResolveAvailableReferenceValue(ctx, user.ID, bearerToken, &input.ResolveVariableReferenceInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ResolveAvailableVariableReferenceResponse{}
	resp.Body.Data = resolved
	return resp, nil
}

// Resolve
type ResolveVariableReferenceInput struct {
	server.BaseAuthInput
	ServiceID   uuid.UUID `query:"service_id" required:"true"`
	ReferenceID uuid.UUID `query:"reference_id" required:"true"`
}

type ResolveVariableReferenceResponse struct {
	Body struct {
		Data string `json:"data"`
	}
}

func (self *HandlerGroup) ResolveVariableReference(ctx context.Context, input *ResolveVariableReferenceInput) (*ResolveVariableReferenceResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	resolved, err := self.srv.VariablesService.ResolveSingleReference(ctx, user.ID, bearerToken, input.ServiceID, input.ReferenceID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ResolveVariableReferenceResponse{}
	resp.Body.Data = resolved
	return resp, nil
}
