package template_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListTemplatesResponse struct {
	Body struct {
		Data []*models.TemplateWithDefinitionResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListTemplates(ctx context.Context, input *server.BaseAuthInput) (*ListTemplatesResponse, error) {
	templates, err := self.srv.TemplateService.GetAvailable(ctx)
	if err != nil {
		log.Errorf("Failed to get templates: %v", err)
		return nil, huma.Error500InternalServerError("Failed to get templates")
	}

	resp := &ListTemplatesResponse{}
	resp.Body.Data = templates
	return resp, nil
}

// * BY Id
type GetTemplateByIDInput struct {
	server.BaseAuthInput
	ID uuid.UUID `query:"id" format:"uuid" required:"true"`
}

type GetTemplateResponse struct {
	Body struct {
		Data *models.TemplateWithDefinitionResponse `json:"data"`
	}
}

func (self *HandlerGroup) GetTemplateByID(ctx context.Context, input *GetTemplateByIDInput) (*GetTemplateResponse, error) {
	template, err := self.srv.TemplateService.GetByID(ctx, input.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetTemplateResponse{}
	resp.Body.Data = template
	return resp, nil
}
