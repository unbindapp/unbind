// Package keyaccess holds the access model shared by API keys and OAuth grants:
// a role plus either everything the owner reaches or a list of resources.
package keyaccess

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

type Spec struct {
	Role         schema.PermittedAction
	FullAccess   bool
	Resources    []schema.APIKeyResource
	Capabilities []schema.KeyCapability
}

func Validate(spec Spec) error {
	switch spec.Role {
	case schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer:
	default:
		return fmt.Errorf("unknown role %q", spec.Role)
	}

	if spec.FullAccess && len(spec.Resources) > 0 {
		return errors.New("resources must be empty when full_access is true")
	}
	if !spec.FullAccess && len(spec.Resources) == 0 {
		return errors.New("at least one resource is required unless full_access is true")
	}

	seen := map[uuid.UUID]struct{}{}
	for i, resource := range spec.Resources {
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

	return validateCapabilities(spec)
}

func validateCapabilities(spec Spec) error {
	seen := map[schema.KeyCapability]struct{}{}
	for i, capability := range spec.Capabilities {
		switch capability {
		case schema.CapabilityReadVariableValues, schema.CapabilityReadLogs, schema.CapabilityReadWebhookURLs:
		default:
			return fmt.Errorf("capabilities[%d]: unknown capability %q", i, capability)
		}
		if _, dup := seen[capability]; dup {
			return fmt.Errorf("capabilities[%d]: duplicate capability", i)
		}
		seen[capability] = struct{}{}
	}
	return nil
}

// Capabilities never comes back nil, so responses and stored rows hold a list.
func Capabilities(spec Spec) []schema.KeyCapability {
	if spec.Capabilities == nil {
		return []schema.KeyCapability{}
	}
	return spec.Capabilities
}

// RequesterHolds checks that the requester already has the role on every named
// resource. Full access needs no check: the checker intersects it with the
// owner's grants on every request.
func RequesterHolds(ctx context.Context, perms permissions_repo.PermissionsRepositoryInterface, requesterUserID uuid.UUID, spec Spec) error {
	for _, resource := range spec.Resources {
		err := perms.Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
			Action:       spec.Role,
			ResourceType: resource.ResourceType,
			ResourceID:   resource.ResourceID,
		}})
		if errors.Is(err, errdefs.ErrUnauthorized) {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("you do not have %s access to %s %s", spec.Role, resource.ResourceType, resource.ResourceID))
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// ResourcePaths resolves the names leading to every resource, keyed by resource
// id. Resources that no longer exist are left out so a list shows them as empty
// paths rather than failing.
func ResourcePaths(ctx context.Context, repo repositories.RepositoriesInterface, resources []schema.APIKeyResource) (map[uuid.UUID][]string, error) {
	paths := map[uuid.UUID][]string{}
	for _, resource := range resources {
		if _, done := paths[resource.ResourceID]; done {
			continue
		}
		path, err := resourcePath(ctx, repo, resource)
		if err != nil {
			return nil, err
		}
		if path != nil {
			paths[resource.ResourceID] = path
		}
	}
	return paths, nil
}

func resourcePath(ctx context.Context, repo repositories.RepositoriesInterface, resource schema.APIKeyResource) ([]string, error) {
	switch resource.ResourceType {
	case schema.ResourceTypeTeam:
		team, err := repo.Team().GetByID(ctx, resource.ResourceID)
		if err != nil {
			return nil, ignoreNotFound(err)
		}
		return []string{team.Name}, nil
	case schema.ResourceTypeProject:
		project, err := repo.Project().GetByID(ctx, resource.ResourceID)
		if err != nil || project.Edges.Team == nil {
			return nil, ignoreNotFound(err)
		}
		return []string{project.Edges.Team.Name, project.Name}, nil
	case schema.ResourceTypeEnvironment:
		environment, err := repo.Environment().GetByID(ctx, resource.ResourceID)
		if err != nil || environment.Edges.Project == nil || environment.Edges.Project.Edges.Team == nil {
			return nil, ignoreNotFound(err)
		}
		return []string{environment.Edges.Project.Edges.Team.Name, environment.Edges.Project.Name, environment.Name}, nil
	case schema.ResourceTypeService:
		service, err := repo.Service().GetByID(ctx, resource.ResourceID)
		if err != nil {
			return nil, ignoreNotFound(err)
		}
		environment := service.Edges.Environment
		if environment == nil || environment.Edges.Project == nil || environment.Edges.Project.Edges.Team == nil {
			return nil, nil
		}
		return []string{environment.Edges.Project.Edges.Team.Name, environment.Edges.Project.Name, environment.Name, service.Name}, nil
	default:
		return nil, nil
	}
}

func ignoreNotFound(err error) error {
	if err == nil || ent.IsNotFound(err) {
		return nil
	}
	return err
}
