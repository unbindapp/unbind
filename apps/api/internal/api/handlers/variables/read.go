package variables_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

// List all
type ListVariablesInput struct {
	server.BaseAuthInput
	models.BaseVariablesInput
}

type VariablesResponse struct {
	Body struct {
		Data *models.VariableResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListVariables(ctx context.Context, input *ListVariablesInput) (*VariablesResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	// Get variables
	variableMap, err := self.srv.VariablesService.GetVariables(
		ctx,
		user.ID,
		bearerToken,
		input.BaseVariablesInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &VariablesResponse{}
	resp.Body.Data = variableMap
	return resp, nil
}
