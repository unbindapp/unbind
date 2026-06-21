package variables_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
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
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

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
