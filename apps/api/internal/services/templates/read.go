package templates_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *TemplatesService) GetAvailable(ctx context.Context) ([]*models.TemplateWithDefinitionResponse, error) {
	//  No special permission checks for reading these

	templates, err := self.repo.Template().GetAll(ctx)
	if err != nil {
		return nil, err
	}

	// Transform the entities into response models
	return models.TransformTemplateEntities(templates), nil
}

func (self *TemplatesService) GetByID(ctx context.Context, id uuid.UUID) (*models.TemplateWithDefinitionResponse, error) {
	//  No special permission checks for reading these

	templates, err := self.repo.Template().GetByID(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "template not found")
		}
		return nil, err
	}

	// Transform the entities into response models
	return models.TransformTemplateEntity(templates), nil
}
