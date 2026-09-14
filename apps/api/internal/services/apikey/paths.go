package apikey_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

// resourcePaths resolves the names leading to every resource the keys name,
// keyed by resource id. Resources that no longer exist are left out, so the
// response shows them as empty paths rather than failing the whole list.
func (self *APIKeyService) resourcePaths(ctx context.Context, keys []*ent.APIKey) (map[uuid.UUID][]string, error) {
	paths := map[uuid.UUID][]string{}
	for _, key := range keys {
		for _, resource := range key.Resources {
			if _, done := paths[resource.ResourceID]; done {
				continue
			}
			path, err := self.resourcePath(ctx, resource)
			if err != nil {
				return nil, err
			}
			if path != nil {
				paths[resource.ResourceID] = path
			}
		}
	}
	return paths, nil
}

func (self *APIKeyService) resourcePath(ctx context.Context, resource schema.APIKeyResource) ([]string, error) {
	switch resource.ResourceType {
	case schema.ResourceTypeTeam:
		team, err := self.repo.Team().GetByID(ctx, resource.ResourceID)
		if err != nil {
			return nil, ignoreNotFound(err)
		}
		return []string{team.Name}, nil
	case schema.ResourceTypeProject:
		project, err := self.repo.Project().GetByID(ctx, resource.ResourceID)
		if err != nil || project.Edges.Team == nil {
			return nil, ignoreNotFound(err)
		}
		return []string{project.Edges.Team.Name, project.Name}, nil
	case schema.ResourceTypeEnvironment:
		environment, err := self.repo.Environment().GetByID(ctx, resource.ResourceID)
		if err != nil || environment.Edges.Project == nil || environment.Edges.Project.Edges.Team == nil {
			return nil, ignoreNotFound(err)
		}
		return []string{environment.Edges.Project.Edges.Team.Name, environment.Edges.Project.Name, environment.Name}, nil
	case schema.ResourceTypeService:
		service, err := self.repo.Service().GetByID(ctx, resource.ResourceID)
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
