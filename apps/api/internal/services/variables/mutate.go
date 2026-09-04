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

// validateReferences checks that every referenced source exists in the same project
// and is visible to the writer, and that mounted variables stay literal
func (self *VariablesService) validateReferences(ctx context.Context, userID uuid.UUID, service *ent.Service, newVariables map[string][]byte) error {
	mounted := make(map[string]struct{})
	if service.Edges.ServiceConfig != nil {
		for _, mount := range service.Edges.ServiceConfig.VariableMounts {
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
			if _, ok := seenServices[token.SourceID]; ok {
				continue
			}
			seenServices[token.SourceID] = struct{}{}
			serviceIDs = append(serviceIDs, token.SourceID)
		}
	}

	environment := service.Edges.Environment
	project := environment.Edges.Project
	for scope := range scopes {
		var check permissions_repo.PermissionCheck
		switch scope {
		case schema.VariableReferenceSourceTypeTeam:
			check = permissions_repo.PermissionCheck{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceID: project.TeamID}
		case schema.VariableReferenceSourceTypeProject:
			check = permissions_repo.PermissionCheck{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceID: project.ID}
		case schema.VariableReferenceSourceTypeEnvironment:
			check = permissions_repo.PermissionCheck{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeEnvironment, ResourceID: environment.ID}
		}
		if err := self.repo.Permissions().Check(ctx, userID, []permissions_repo.PermissionCheck{check}); err != nil {
			return errdefs.MaskAsNotFound(err, fmt.Sprintf("Referenced %s not found", scope))
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
		if !ok || source.Edges.Environment == nil || source.Edges.Environment.ProjectID != project.ID {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("Referenced service %s not found in this project", serviceID))
		}
		if err := self.repo.Permissions().Check(ctx, userID, []permissions_repo.PermissionCheck{{
			Action: schema.ActionViewer, ResourceType: schema.ResourceTypeService, ResourceID: serviceID,
		}}); err != nil {
			return errdefs.MaskAsNotFound(err, fmt.Sprintf("Referenced service %s not found in this project", serviceID))
		}
	}

	return nil
}
