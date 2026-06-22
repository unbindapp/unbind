package servicegroups_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type GetServiceGroupTemplateInputsInput struct {
	server.BaseAuthInput
	models.GetServiceGroupInput
}

type GetServiceGroupTemplateInputsResponse struct {
	Body struct {
		Data *models.ServiceGroupTemplateInputsResponse `json:"data"`
	}
}

func (self *HandlerGroup) GetServiceGroupTemplateInputs(ctx context.Context, input *GetServiceGroupTemplateInputsInput) (*GetServiceGroupTemplateInputsResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	data, err := self.srv.ServiceGroupService.GetTemplateInputs(ctx, user.ID, bearerToken, &input.GetServiceGroupInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetServiceGroupTemplateInputsResponse{}
	resp.Body.Data = data
	return resp, nil
}

type UpdateServiceGroupTemplateInputsInput struct {
	server.BaseAuthInput
	Body *models.UpdateServiceGroupTemplateInputsInput
}

type UpdateServiceGroupTemplateInputsResponse struct {
	Body struct {
		Data *models.ServiceGroupTemplateInputsResponse `json:"data"`
	}
}

func (self *HandlerGroup) UpdateServiceGroupTemplateInputs(ctx context.Context, input *UpdateServiceGroupTemplateInputsInput) (*UpdateServiceGroupTemplateInputsResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	data, err := self.srv.ServiceGroupService.UpdateTemplateInputs(ctx, user.ID, bearerToken, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateServiceGroupTemplateInputsResponse{}
	resp.Body.Data = data
	return resp, nil
}
