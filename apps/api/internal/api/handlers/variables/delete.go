package variables_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

// Delete variables
type DeleteVariablesInput struct {
	server.BaseAuthInput
	Body struct {
		models.BaseVariablesJSONInput
		Variables            []models.VariableDeleteInput `json:"variables" required:"false" nullable:"false"`
		VariableReferenceIDs []uuid.UUID                  `json:"variable_reference_ids" required:"false" nullable:"false"`
	}
}

func (self *HandlerGroup) DeleteVariables(ctx context.Context, input *DeleteVariablesInput) (*VariablesResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	variableMap, err := self.srv.VariablesService.DeleteVariablesByKey(
		ctx,
		user.ID,
		bearerToken,
		input.Body.BaseVariablesJSONInput,
		input.Body.Variables,
		input.Body.VariableReferenceIDs,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	// If any references were updated, we need a new deployment
	if input.Body.Type == schema.VariableReferenceSourceTypeService && len(input.Body.VariableReferenceIDs) > 0 {
		service, err := self.srv.Repository.Service().GetByID(ctx, input.Body.ServiceID)
		if err != nil {
			log.Errorf("Error getting service: %v", err)
			// Don't fail
		} else {
			_, err := self.srv.ServiceService.DeployAdhocServices(ctx, []*ent.Service{service})
			if err != nil {
				log.Errorf("Error deploying service: %v", err)
			}
		}
	}

	resp := &VariablesResponse{}
	resp.Body.Data = variableMap
	return resp, nil
}
