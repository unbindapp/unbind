package system_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	system_service "github.com/unbindapp/unbind-api/internal/services/system"
)

type StorageResponse struct {
	AllocatableStorageBytes string `json:"allocatable_storage_bytes"`
	StorageClass            string `json:"storage_class_name"`
	UnableToGetAllocatable  bool   `json:"unable_to_get_allocatable"`
}

type SystemMeta struct {
	ExternalIPV6           string                                 `json:"external_ipv6" nullable:"false"`
	ExternalIPV4           string                                 `json:"external_ipv4" nullable:"false"`
	Storage                *k8s.StorageMetadata                   `json:"storage" nullable:"false"`
	SystemSettings         *system_service.SystemSettingsResponse `json:"system_settings" nullable:"false"`
	NetworkingProvider     string                                 `json:"networking_provider" nullable:"false"`
	NetworkingCapabilities []string                               `json:"networking_capabilities" nullable:"false"`
}

type SystemMetaResponse struct {
	Body struct {
		Data *SystemMeta `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetSystemInformation(ctx context.Context, input *server.BaseAuthInput) (*SystemMetaResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	storageMetadata, err := self.srv.KubeClient.AvailableStorageBytes(ctx)
	if err != nil {
		log.Error("Unable to get available storage bytes", "err", err)
	}
	// Get k8s IPs for load balancer server
	ips, err := self.srv.KubeClient.GetIngressNginxIP(ctx)
	if err != nil {
		log.Error("Error getting ingress nginx IP", "err", err)
		return nil, huma.Error500InternalServerError("Error getting ingress nginx IP")
	}

	meta := &SystemMeta{
		ExternalIPV6:           ips.IPv6,
		ExternalIPV4:           ips.IPv4,
		Storage:                storageMetadata,
		NetworkingProvider:     self.srv.KubeClient.NetworkingProvider(ctx),
		NetworkingCapabilities: self.srv.KubeClient.NetworkingCapabilities(ctx),
	}

	// Get buildkit settings
	settings, err := self.srv.SystemService.GetSettings(ctx, user.ID)
	if err != nil {
		log.Error("Error getting buildkit settings", "err", err)
		return nil, oapi.MapError(err)
	}
	meta.SystemSettings = settings

	return &SystemMetaResponse{
		Body: struct {
			Data *SystemMeta `json:"data" nullable:"false"`
		}{Data: meta},
	}, nil
}
