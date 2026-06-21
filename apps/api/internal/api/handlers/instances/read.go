package instances_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
)

// List instances (pods) for a service
type ListInstancesInput struct {
	server.BaseAuthInput
	models.InstanceStatusInput
}

type ListInstancesResponse struct {
	Body struct {
		Data []k8s.PodContainerStatus `json:"data" nullable:"false"`
	}
}

// ListInstances gets pods/statuses for a service
func (self *HandlerGroup) ListInstances(ctx context.Context, input *ListInstancesInput) (*ListInstancesResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	containers, err := self.srv.InstanceService.GetInstanceStatuses(
		ctx,
		user.ID,
		bearerToken,
		&input.InstanceStatusInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListInstancesResponse{}
	resp.Body.Data = containers
	return resp, nil
}

// Get instance health for a service
type GetInstanceHealthInput struct {
	server.BaseAuthInput
	models.InstanceHealthInput
}

type GetInstanceHealthResponse struct {
	Body struct {
		Data *k8s.SimpleHealthStatus `json:"data" nullable:"false"`
	}
}

// GetInstanceHealth gets pod health for a service
func (self *HandlerGroup) GetInstanceHealth(ctx context.Context, input *GetInstanceHealthInput) (*GetInstanceHealthResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	health, err := self.srv.InstanceService.GetInstanceHealth(
		ctx,
		user.ID,
		bearerToken,
		&input.InstanceHealthInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetInstanceHealthResponse{}
	resp.Body.Data = health
	return resp, nil
}
