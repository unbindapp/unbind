package template_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type TemplateDeployInput struct {
	server.BaseAuthInput
	Body *models.TemplateDeployInput
}

type TemplateDeployResponse struct {
	Body struct {
		Data []*models.ServiceResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) DeployTemplate(ctx context.Context, input *TemplateDeployInput) (*TemplateDeployResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	services, err := self.srv.TemplateService.DeployTemplate(ctx, user.ID, bearerToken, input.Body)
	if err != nil {
		log.Errorf("Error deploying template: %v", err)
		return nil, oapi.MapError(err)
	}

	resp := &TemplateDeployResponse{}
	resp.Body.Data = services
	return resp, nil
}
