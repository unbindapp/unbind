package templates_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	predefined "github.com/unbindapp/unbind-api/pkg/templates"
)

func (self *TemplatesService) GetAvailable(ctx context.Context) ([]*models.TemplateWithDefinitionResponse, error) {
	//  No special permission checks for reading these

	templates, err := self.repo.Template().GetAll(ctx)
	if err != nil {
		return nil, err
	}

	// Hide templates whose required networking capabilities the cluster's provider
	// can't satisfy (e.g. TLS passthrough on ingress-nginx).
	capable := map[string]bool{}
	for _, c := range self.k8s.NetworkingCapabilities(ctx) {
		capable[c] = true
	}

	// Seeding never deletes rows, so a renamed or removed template keeps its old rows
	// for the services that reference them. Only names the code still defines are offered.
	defined := map[string]bool{}
	for _, t := range predefined.NewTemplater(nil).AvailableTemplates() {
		defined[t.Name] = true
	}

	transformed := models.TransformTemplateEntities(templates)
	supported := make([]*models.TemplateWithDefinitionResponse, 0, len(transformed))
	for _, t := range transformed {
		if !defined[t.Name] {
			continue
		}
		if capabilitiesSatisfied(t.Definition.RequiredCapabilities, capable) {
			supported = append(supported, t)
		}
	}
	return supported, nil
}

func capabilitiesSatisfied(required []string, capable map[string]bool) bool {
	for _, c := range required {
		if !capable[c] {
			return false
		}
	}
	return true
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
