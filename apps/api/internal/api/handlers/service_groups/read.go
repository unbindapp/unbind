package servicegroups_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListServiceGroupInput struct {
	server.BaseAuthInput
	models.ListServiceGroupsInput
}

type ListServiceGroupResponse struct {
	Body struct {
		Data []*models.ServiceGroupResponse `json:"data" nullable:"false"`
	}
}

// ListServiceGroups handles GET /service_groups/list
func (self *HandlerGroup) ListServiceGroups(ctx context.Context, input *ListServiceGroupInput) (*ListServiceGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	serviceGroups, err := self.srv.ServiceGroupService.GetServiceGroupByEnvironment(
		ctx,
		user.ID,
		&input.ListServiceGroupsInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListServiceGroupResponse{}
	resp.Body.Data = serviceGroups
	return resp, nil
}

// Get a single service group by ID
type GetServiceGroupInput struct {
	server.BaseAuthInput
	models.GetServiceGroupInput
}

type GetServiceGroupResponse struct {
	Body struct {
		Data *models.ServiceGroupResponse `json:"data"`
	}
}

// GetServiceGroup handles GET /service_groups/get
func (self *HandlerGroup) GetServiceGroup(ctx context.Context, input *GetServiceGroupInput) (*GetServiceGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	serviceGroup, err := self.srv.ServiceGroupService.GetServiceGroupByID(
		ctx,
		user.ID,
		&input.GetServiceGroupInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetServiceGroupResponse{}
	resp.Body.Data = serviceGroup
	return resp, nil
}
