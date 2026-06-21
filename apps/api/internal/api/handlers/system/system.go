package system_handler

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

type HandlerGroup struct {
	srv *server.Server
}

func RegisterHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{
		srv: server,
	}

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-system-information",
		Summary:     "Get System Information",
		Description: "Get system information such as the external load balancer IP, used for DNS configuration.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetSystemInformation)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-system-settings",
		Summary:     "Update System Settings",
		Description: "Update system-wide settings such as the wildcard domain and buildkit configuration.",
		Path:        "/settings/update",
		Method:      http.MethodPut,
	}, handlers.UpdateBuildkitSettings)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "check-dns-resolution",
		Summary:     "Check DNS Resolution",
		Description: "Check whether a domain resolves to this cluster's ingress IP.",
		Path:        "/dns/check",
		Method:      http.MethodGet,
	}, handlers.CheckDNSResolution, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "check-for-updates",
		Summary:     "Check for Updates",
		Description: "Check whether a newer Unbind release is available.",
		Path:        "/update/check",
		Method:      http.MethodGet,
	}, handlers.CheckForUpdates, oapi.OpenWorld)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "apply-update",
		Summary:     "Apply Update",
		Description: "Upgrade Unbind to a target version. Pulls new images and restarts system components; expect downtime.",
		Path:        "/update/apply",
		Method:      http.MethodPost,
	}, handlers.ApplyUpdate, oapi.OpenWorld, oapi.Confirm, oapi.Risk("high"))

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-update-status",
		Summary:     "Get Update Status",
		Description: "Get the status of an in-progress or completed system update.",
		Path:        "/update/status",
		Method:      http.MethodGet,
	}, handlers.GetUpdateStatus)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "generate-wildcard-domain",
		Summary:     "Generate Wildcard Domain",
		Description: "Generate an unbind.app wildcard subdomain from a base name.",
		Path:        "/domain/generate",
		Method:      http.MethodPost,
	}, handlers.GenerateWildcardDomain)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "check-unique-domain",
		Summary:     "Check Unique Domain",
		Description: "Check whether a domain is already in use within this system.",
		Path:        "/domain/check",
		Method:      http.MethodGet,
	}, handlers.CheckForDomainCollision)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-registry",
		Summary:     "Create Registry",
		Description: "Add a container registry the system can push and pull images from.",
		Path:        "/registries/create",
		Method:      http.MethodPost,
	}, handlers.CreateRegistry, oapi.OpenWorld)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-registry",
		Summary:     "Delete Registry",
		Description: "Remove a container registry.",
		Path:        "/registries/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteRegistry)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-registry",
		Summary:     "Get Registry",
		Description: "Get a single container registry by ID.",
		Path:        "/registries/get",
		Method:      http.MethodGet,
	}, handlers.GetRegistry)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-registries",
		Summary:     "List Registries",
		Description: "List all configured container registries.",
		Path:        "/registries/list",
		Method:      http.MethodGet,
	}, handlers.ListRegistries)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "set-default-registry",
		Summary:     "Set Default Registry",
		Description: "Set which registry new builds push to by default.",
		Path:        "/registries/set-default",
		Method:      http.MethodPost,
	}, handlers.SetDefaultRegistry)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-registry-cache-config",
		Summary:     "Get Registry Cache Config",
		Description: "Get the configurable settings of the self-hosted registry cache (build cache + images).",
		Path:        "/cache/registry/config",
		Method:      http.MethodGet,
	}, handlers.GetRegistryCacheConfig)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-registry-cache-stats",
		Summary:     "Get Registry Cache Stats",
		Description: "Get usage statistics and last cleanup status for the self-hosted registry cache.",
		Path:        "/cache/registry/stats",
		Method:      http.MethodGet,
	}, handlers.GetRegistryCacheStats)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-registry-cache",
		Summary:     "Update Registry Cache",
		Description: "Update the self-hosted registry cache cleanup threshold, schedule, or volume size.",
		Path:        "/cache/registry/update",
		Method:      http.MethodPut,
	}, handlers.UpdateRegistryCache)
}
