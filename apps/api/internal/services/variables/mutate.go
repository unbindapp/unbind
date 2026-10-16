package variables_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

// UpdateVariables writes variables in bulk. The returned bool is true when a rendered
// value changed, meaning the service needs a new deployment rather than a pod restart.
func (self *VariablesService) UpdateVariables(
	ctx context.Context,
	userID uuid.UUID,
	input models.BaseVariablesJSONInput,
	behavior models.VariableUpdateBehavior,
	newVariables map[string][]byte,
) (*models.VariableResponse, bool, error) {
	write, err := self.PrepareVariableWrite(ctx, userID, input, behavior, newVariables, nil)
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

// Drop mounts and metadata for variables that an overwrite removes
func (self *VariablesService) pruneVariableConfig(ctx context.Context, tx repository.TxInterface, service *ent.Service, newVariables map[string][]byte) error {
	config := service.Edges.ServiceConfig

	var variableMounts []*schema.VariableMount
	mountsChanged := false
	for _, mount := range config.VariableMounts {
		if _, ok := newVariables[mount.Name]; !ok {
			mountsChanged = true
			continue
		}
		variableMounts = append(variableMounts, mount)
	}
	if mountsChanged {
		if err := self.repo.Service().UpdateVariableMounts(ctx, tx, service.ID, variableMounts); err != nil {
			return err
		}
	}

	metadataChanged := false
	for name := range config.VariableMetadata {
		if _, ok := newVariables[name]; !ok {
			delete(config.VariableMetadata, name)
			metadataChanged = true
		}
	}
	if metadataChanged {
		if err := self.repo.Service().UpdateVariableMetadata(ctx, tx, service.ID, config.VariableMetadata); err != nil {
			return err
		}
	}

	return nil
}

// referenceScope is where a value is written, which bounds what it may reference.
// projectID and environmentID are nil above those levels; service is set for a
// service's own variables, whose self-references need no lookup.
type referenceScope struct {
	teamID        uuid.UUID
	projectID     uuid.UUID
	environmentID uuid.UUID
	service       *ent.Service
}

func serviceScope(service *ent.Service) referenceScope {
	environment := service.Edges.Environment
	return referenceScope{teamID: environment.Edges.Project.TeamID, projectID: environment.ProjectID, environmentID: environment.ID, service: service}
}

func (s referenceScope) scopeCheck(sourceType schema.VariableReferenceSourceType) (permissions_repo.PermissionCheck, error) {
	switch sourceType {
	case schema.VariableReferenceSourceTypeTeam:
		return permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeTeam, ResourceID: s.teamID}, nil
	case schema.VariableReferenceSourceTypeProject:
		if s.projectID != uuid.Nil {
			return permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeProject, ResourceID: s.projectID}, nil
		}
	case schema.VariableReferenceSourceTypeEnvironment:
		if s.environmentID != uuid.Nil {
			return permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeEnvironment, ResourceID: s.environmentID}, nil
		}
	}
	return permissions_repo.PermissionCheck{}, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("A variable here can't reference %s variables", sourceType))
}

func (s referenceScope) contains(source *ent.Service) bool {
	environment := source.Edges.Environment
	if environment == nil {
		return false
	}
	if s.projectID != uuid.Nil {
		return environment.ProjectID == s.projectID
	}
	return environment.Edges.Project != nil && environment.Edges.Project.TeamID == s.teamID
}

func (s referenceScope) where() string {
	if s.projectID != uuid.Nil {
		return "project"
	}
	return "team"
}

// validateReferences checks that every referenced source sits inside the scope and
// that the writer holds editor on it, since a reference shows its value to everyone
// who can read the written variables. Mounted variables stay literal and no variable
// references itself.
func (self *VariablesService) validateReferences(ctx context.Context, userID uuid.UUID, scope referenceScope, newVariables map[string][]byte) error {
	mounted := make(map[string]struct{})
	if scope.service != nil && scope.service.Edges.ServiceConfig != nil {
		for _, mount := range scope.service.Edges.ServiceConfig.VariableMounts {
			mounted[mount.Name] = struct{}{}
		}
	}

	scopes := make(map[schema.VariableReferenceSourceType]struct{})
	seenServices := make(map[uuid.UUID]struct{})
	var serviceIDs []uuid.UUID
	for name, value := range newVariables {
		tokens := vartemplate.Parse(string(value))
		if len(tokens) == 0 {
			continue
		}
		if _, ok := mounted[name]; ok {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Variable %s is mounted as a file and can't contain references", name))
		}
		for _, token := range tokens {
			if token.SourceType != schema.VariableReferenceSourceTypeService {
				scopes[token.SourceType] = struct{}{}
				continue
			}
			if scope.service != nil && token.SourceID == scope.service.ID {
				if token.Key == name {
					return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Variable %s can't reference itself", name))
				}
				continue
			}
			if _, ok := seenServices[token.SourceID]; ok {
				continue
			}
			seenServices[token.SourceID] = struct{}{}
			serviceIDs = append(serviceIDs, token.SourceID)
		}
	}

	for sourceType := range scopes {
		check, err := scope.scopeCheck(sourceType)
		if err != nil {
			return err
		}
		if err := self.repo.Permissions().Check(ctx, userID, []permissions_repo.PermissionCheck{check}); err != nil {
			return errdefs.MaskAsNotFound(err, fmt.Sprintf("Referenced %s not found", sourceType))
		}
	}

	if len(serviceIDs) == 0 {
		return nil
	}

	sources, err := self.repo.Service().GetByIDs(ctx, serviceIDs)
	if err != nil {
		return err
	}
	sourceByID := make(map[uuid.UUID]*ent.Service, len(sources))
	for _, source := range sources {
		sourceByID[source.ID] = source
	}
	for _, serviceID := range serviceIDs {
		source, ok := sourceByID[serviceID]
		if !ok || !scope.contains(source) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("Referenced service %s not found in this %s", serviceID, scope.where()))
		}
		if err := self.repo.Permissions().Check(ctx, userID, []permissions_repo.PermissionCheck{{
			Action: schema.ActionEditor, ResourceType: schema.ResourceTypeService, ResourceID: serviceID,
		}}); err != nil {
			return errdefs.MaskAsNotFound(err, fmt.Sprintf("Referenced service %s not found in this %s", serviceID, scope.where()))
		}
	}

	return nil
}
