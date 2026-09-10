package replicas_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
)

// List replicas (pods) for a service
type ListReplicasInput struct {
	server.BaseAuthInput
	models.ReplicaStatusInput
}

type ListReplicasResponse struct {
	Body struct {
		Data []k8s.PodContainerStatus `json:"data" nullable:"false"`
	}
}

// ListReplicas gets pods/statuses for a service
func (self *HandlerGroup) ListReplicas(ctx context.Context, input *ListReplicasInput) (*ListReplicasResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	containers, err := self.srv.ReplicaService.GetReplicaStatuses(
		ctx,
		user.ID,
		&input.ReplicaStatusInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListReplicasResponse{}
	resp.Body.Data = containers
	return resp, nil
}

// Get replica health for a service
type GetReplicaHealthInput struct {
	server.BaseAuthInput
	models.ReplicaHealthInput
}

type GetReplicaHealthResponse struct {
	Body struct {
		Data *k8s.SimpleHealthStatus `json:"data" nullable:"false"`
	}
}

// GetReplicaHealth gets pod health for a service
func (self *HandlerGroup) GetReplicaHealth(ctx context.Context, input *GetReplicaHealthInput) (*GetReplicaHealthResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	health, err := self.srv.ReplicaService.GetReplicaHealth(
		ctx,
		user.ID,
		&input.ReplicaHealthInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetReplicaHealthResponse{}
	resp.Body.Data = health
	return resp, nil
}
