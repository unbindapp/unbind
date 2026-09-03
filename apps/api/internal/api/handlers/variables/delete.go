package variables_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type DeleteVariablesInput struct {
	server.BaseAuthInput
	Body struct {
		models.BaseVariablesJSONInput
		Variables []models.VariableDeleteInput `json:"variables" required:"true" nullable:"false"`
	}
}

func (self *HandlerGroup) DeleteVariables(ctx context.Context, input *DeleteVariablesInput) (*VariablesResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	variableMap, needsRedeploy, err := self.srv.VariablesService.DeleteVariablesByKey(
		ctx,
		user.ID,
		input.Body.BaseVariablesJSONInput,
		input.Body.Variables,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	if needsRedeploy {
		self.redeployService(ctx, input.Body.ServiceID)
	}

	// Re-deploy anything referencing the deleted variables so breakage surfaces instead of going stale
	if len(input.Body.Variables) > 0 {
		keys := make([]string, len(input.Body.Variables))
		for i, variable := range input.Body.Variables {
			keys[i] = variable.Name
		}
		self.srv.ServiceService.RedeployReferencingServices(ctx, input.Body.Type, variableSourceID(input.Body.BaseVariablesJSONInput), keys)
	}

	resp := &VariablesResponse{}
	resp.Body.Data = variableMap
	return resp, nil
}
