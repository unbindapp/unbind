package apikey_service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	apikey_repo "github.com/unbindapp/unbind-api/internal/repositories/apikey"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Create issues a key for the requester. A scoped key must name resources the
// requester already holds at the key's role. A full-access key needs no check
// here because the checker intersects it with the owner's grants on every
// request, so it can never reach further than the owner.
func (self *APIKeyService) Create(ctx context.Context, requesterUserID uuid.UUID, input *models.APIKeyCreateInput) (*models.APIKeyCreatedResponse, error) {
	if input.ExpiresAt != nil && !input.ExpiresAt.After(time.Now()) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "expires_at must be in the future")
	}
	if err := validateAccess(input); err != nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
	}

	for _, resource := range input.Resources {
		if err := self.requesterHolds(ctx, requesterUserID, input.Role, resource); err != nil {
			return nil, err
		}
	}

	generated, err := auth.NewAPIKey()
	if err != nil {
		return nil, errdefs.NewInternalError(err, "Failed to generate the API key")
	}

	resources := input.Resources
	if resources == nil {
		resources = []schema.APIKeyResource{}
	}
	key, err := self.repo.APIKey().Create(ctx, &apikey_repo.CreateAPIKeyInput{
		UserID:      requesterUserID,
		Name:        input.Name,
		TokenPrefix: generated.Prefix,
		TokenHash:   generated.Hash,
		Role:        input.Role,
		FullAccess:  input.FullAccess,
		Resources:   resources,
		ExpiresAt:   input.ExpiresAt,
	})
	if err != nil {
		return nil, err
	}

	paths, err := self.resourcePaths(ctx, []*ent.APIKey{key})
	if err != nil {
		return nil, err
	}
	return &models.APIKeyCreatedResponse{
		APIKeyResponse: *models.TransformAPIKeyEntity(key, paths),
		Token:          generated.Token,
	}, nil
}

func validateAccess(input *models.APIKeyCreateInput) error {
	switch input.Role {
	case schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer:
	default:
		return fmt.Errorf("unknown role %q", input.Role)
	}

	if input.FullAccess && len(input.Resources) > 0 {
		return errors.New("resources must be empty when full_access is true")
	}
	if !input.FullAccess && len(input.Resources) == 0 {
		return errors.New("at least one resource is required unless full_access is true")
	}

	seen := map[uuid.UUID]struct{}{}
	for i, resource := range input.Resources {
		switch resource.ResourceType {
		case schema.ResourceTypeTeam, schema.ResourceTypeProject, schema.ResourceTypeEnvironment, schema.ResourceTypeService:
		default:
			return fmt.Errorf("resources[%d]: resource type must be team, project, environment or service", i)
		}
		if resource.ResourceID == uuid.Nil {
			return fmt.Errorf("resources[%d]: resource_id is required", i)
		}
		if _, dup := seen[resource.ResourceID]; dup {
			return fmt.Errorf("resources[%d]: duplicate resource", i)
		}
		seen[resource.ResourceID] = struct{}{}
	}
	return nil
}

func (self *APIKeyService) requesterHolds(ctx context.Context, requesterUserID uuid.UUID, role schema.PermittedAction, resource schema.APIKeyResource) error {
	err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
		Action:       role,
		ResourceType: resource.ResourceType,
		ResourceID:   resource.ResourceID,
	}})
	if errors.Is(err, errdefs.ErrUnauthorized) {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("you do not have %s access to %s %s", role, resource.ResourceType, resource.ResourceID))
	}
	return err
}
