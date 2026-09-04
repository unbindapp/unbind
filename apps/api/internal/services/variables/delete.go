package variables_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/models"
)

// DeleteVariablesByKey removes variables. The returned bool is true when a rendered
// value was removed, meaning the service needs a new deployment rather than a pod restart.
func (self *VariablesService) DeleteVariablesByKey(ctx context.Context, userID uuid.UUID, input models.BaseVariablesJSONInput, keys []models.VariableDeleteInput) (*models.VariableResponse, bool, error) {
	names := make([]string, len(keys))
	for i, key := range keys {
		names[i] = key.Name
	}

	write, err := self.PrepareVariableWrite(ctx, userID, input, models.VariableUpdateBehaviorUpsert, nil, names)
	if err != nil {
		return nil, false, err
	}

	response, err := self.ApplyVariableWrite(ctx, write)
	if err != nil {
		return nil, false, err
	}

	if err := self.RestartForWrite(ctx, write); err != nil {
		return nil, false, err
	}

	return response, write.NeedsRedeploy, nil
}
