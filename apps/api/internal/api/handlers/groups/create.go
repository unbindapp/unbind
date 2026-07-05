package groups_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	group_service "github.com/unbindapp/unbind-api/internal/services/group"
)

type CreateGroupInput struct {
	server.BaseAuthInput
	Body struct {
		Name        string `json:"name" required:"true" minLength:"1"`
		Description string `json:"description" required:"true"`
	}
}

type CreateGroupResponse struct {
	Body struct {
		Data *models.GroupResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) CreateGroup(ctx context.Context, input *CreateGroupInput) (*CreateGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	group, err := self.srv.GroupService.CreateGroup(ctx, user.ID, &group_service.GroupCreateInput{
		Name:        input.Body.Name,
		Description: input.Body.Description,
	})
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateGroupResponse{}
	resp.Body.Data = models.TransformGroupEntity(group)
	return resp, nil
}
