package apikey_service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	apikey_repo "github.com/unbindapp/unbind-api/internal/repositories/apikey"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Create issues a key for the requester. Every scope is checked against the
// requester's own permissions, so a key starts as a subset of its owner. The
// checker keeps it a subset afterwards by intersecting at request time.
func (self *APIKeyService) Create(ctx context.Context, requesterUserID uuid.UUID, input *models.APIKeyCreateInput) (*models.APIKeyCreatedResponse, error) {
	if input.ExpiresAt != nil && !input.ExpiresAt.After(time.Now()) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "expires_at must be in the future")
	}

	for i, scope := range input.Scopes {
		if err := validateScope(scope); err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("scopes[%d]: %v", i, err))
		}
		if err := self.requesterHolds(ctx, requesterUserID, scope); err != nil {
			return nil, err
		}
	}

	generated, err := auth.NewAPIKey()
	if err != nil {
		return nil, errdefs.NewInternalError(err, "Failed to generate the API key")
	}

	key, err := self.repo.APIKey().Create(ctx, &apikey_repo.CreateAPIKeyInput{
		UserID:      requesterUserID,
		Name:        input.Name,
		TokenPrefix: generated.Prefix,
		TokenHash:   generated.Hash,
		Scopes:      input.Scopes,
		ExpiresAt:   input.ExpiresAt,
	})
	if err != nil {
		return nil, err
	}

	return &models.APIKeyCreatedResponse{
		APIKeyResponse: *models.TransformAPIKeyEntity(key),
		Token:          generated.Token,
	}, nil
}

func validateScope(scope schema.APIKeyScope) error {
	switch scope.Action {
	case schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer:
	default:
		return fmt.Errorf("unknown action %q", scope.Action)
	}

	switch scope.ResourceType {
	case schema.ResourceTypeSystem, schema.ResourceTypeTeam, schema.ResourceTypeProject, schema.ResourceTypeEnvironment, schema.ResourceTypeService:
	default:
		return fmt.Errorf("unknown resource type %q", scope.ResourceType)
	}

	selector := scope.ResourceSelector
	switch {
	case selector.Superuser && selector.ID != uuid.Nil:
		return errors.New("resource_selector must set either superuser or id, not both")
	case !selector.Superuser && selector.ID == uuid.Nil:
		return errors.New("resource_selector must set superuser or id")
	case scope.ResourceType == schema.ResourceTypeSystem && !selector.Superuser:
		return errors.New("system scopes must use superuser")
	}
	return nil
}

// requesterHolds runs the ordinary permission check as the requester. A
// superuser scope only passes when the requester is superuser for that type,
// because a check with no resource id matches nothing narrower.
func (self *APIKeyService) requesterHolds(ctx context.Context, requesterUserID uuid.UUID, scope schema.APIKeyScope) error {
	check := permissions_repo.PermissionCheck{
		Action:       scope.Action,
		ResourceType: scope.ResourceType,
	}
	if !scope.ResourceSelector.Superuser {
		check.ResourceID = scope.ResourceSelector.ID
	}

	err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{check})
	if errors.Is(err, errdefs.ErrUnauthorized) {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("scope %s on %s exceeds your permissions", scope.Action, describeScope(scope)))
	}
	return err
}

func describeScope(scope schema.APIKeyScope) string {
	if scope.ResourceSelector.Superuser {
		return fmt.Sprintf("all %s resources", scope.ResourceType)
	}
	return fmt.Sprintf("%s %s", scope.ResourceType, scope.ResourceSelector.ID)
}
