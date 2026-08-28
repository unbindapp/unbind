package variables_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

// Create new
type UpsertVariablesInput struct {
	server.BaseAuthInput
	Body struct {
		models.BaseVariablesJSONInput
		Behavior  models.VariableUpdateBehavior `json:"behavior" default:"upsert" required:"true" doc:"The behavior of the update - upsert or overwrite"`
		Variables []*struct {
			Name  string `json:"name" required:"true"`
			Value string `json:"value" required:"true"`
		} `json:"variables" required:"true"`
		VariableReferences []*models.VariableReferenceInputItem `json:"variable_references" required:"false"`
	}
}

func (self *HandlerGroup) UpdateVariables(ctx context.Context, input *UpsertVariablesInput) (*VariablesResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	variablesUpdateMap := make(map[string][]byte)
	for _, variable := range input.Body.Variables {
		variablesUpdateMap[variable.Name] = []byte(variable.Value)
	}

	variableMap, err := self.srv.VariablesService.UpdateVariables(
		ctx,
		user.ID,
		input.Body.VariableReferences,
		input.Body.BaseVariablesJSONInput,
		input.Body.Behavior,
		variablesUpdateMap,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	// If any references were updated, we need a new deployment
	if input.Body.Type == schema.VariableReferenceSourceTypeService && len(input.Body.VariableReferences) > 0 {
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

	// Re-deploy anything referencing these
	if len(input.Body.Variables) > 0 {
		keys := make([]string, len(input.Body.Variables))
		for i, variable := range input.Body.Variables {
			keys[i] = variable.Name
		}
		self.srv.ServiceService.RedeployReferencingServices(ctx, variableSourceID(input.Body.BaseVariablesJSONInput), keys)
	}

	resp := &VariablesResponse{}
	resp.Body.Data = variableMap
	return resp, nil
}

func variableSourceID(input models.BaseVariablesJSONInput) uuid.UUID {
	switch input.Type {
	case schema.VariableReferenceSourceTypeTeam:
		return input.TeamID
	case schema.VariableReferenceSourceTypeProject:
		return input.ProjectID
	case schema.VariableReferenceSourceTypeEnvironment:
		return input.EnvironmentID
	case schema.VariableReferenceSourceTypeService:
		return input.ServiceID
	}
	return uuid.Nil
}
