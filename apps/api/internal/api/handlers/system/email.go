package system_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	email_service "github.com/unbindapp/unbind-api/internal/services/email"
)

type EmailSettingsResponse struct {
	Body struct {
		Data *email_service.EmailSettingsResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetEmailSettings(ctx context.Context, input *server.BaseAuthInput) (*EmailSettingsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := self.srv.EmailService.GetSettings(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &EmailSettingsResponse{}
	resp.Body.Data = settings
	return resp, nil
}

type UpdateEmailSettingsInput struct {
	server.BaseAuthInput
	Body *email_service.EmailSettingsUpdateInput
}

func (self *HandlerGroup) UpdateEmailSettings(ctx context.Context, input *UpdateEmailSettingsInput) (*EmailSettingsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := self.srv.EmailService.UpdateSettings(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &EmailSettingsResponse{}
	resp.Body.Data = settings
	return resp, nil
}

type SuccessResponse struct {
	Body struct {
		Data server.SuccessResponse `json:"data"`
	}
}

func (self *HandlerGroup) ClearEmailSettings(ctx context.Context, input *server.BaseAuthInput) (*SuccessResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.EmailService.ClearSettings(ctx, user.ID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &SuccessResponse{}
	resp.Body.Data = server.SuccessResponse{Success: true}
	return resp, nil
}

func (self *HandlerGroup) SendTestEmail(ctx context.Context, input *server.BaseAuthInput) (*SuccessResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.EmailService.SendTest(ctx, user.ID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &SuccessResponse{}
	resp.Body.Data = server.SuccessResponse{Success: true}
	return resp, nil
}
