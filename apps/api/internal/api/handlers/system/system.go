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
	}, handlers.UpdateSettings)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "check-dns-resolution",
		Summary:     "Check DNS Resolution",
		Description: "Check whether a domain resolves to this cluster's ingress IP.",
		Path:        "/dns/check",
		Method:      http.MethodGet,
	}, handlers.CheckDNSResolution, oapi.OpenWorld)

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
		Description: "Get available Unbind releases and the status of an in-progress or completed system update.",
		Path:        "/update/status",
		Method:      http.MethodGet,
	}, handlers.GetUpdateStatus, oapi.OpenWorld)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "check-for-updates",
		Summary:     "Check for Updates",
		Description: "Fetch the Unbind release list from GitHub now instead of serving the cached one, then return the update status.",
		Path:        "/update/check",
		Method:      http.MethodPost,
		Errors:      []int{http.StatusBadGateway},
	}, handlers.CheckForUpdates, oapi.OpenWorld)

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

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "start-registry-cleanup",
		Summary:     "Start Registry Cleanup",
		Description: "Run the self-hosted registry cleanup now. It deletes every image that is not deployed, pushed in the last hour, or the newest of its repository, then frees the space.",
		Path:        "/cache/registry/cleanup",
		Method:      http.MethodPost,
	}, handlers.StartRegistryCleanup)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-email-settings",
		Summary:     "Get Email Settings",
		Description: "Get the outgoing mail relay. The password is never returned.",
		Path:        "/email/get",
		Method:      http.MethodGet,
	}, handlers.GetEmailSettings)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-email-settings",
		Summary:     "Update Email Settings",
		Description: "Set the outgoing mail relay Unbind sends invitations and notifications through.",
		Path:        "/email/update",
		Method:      http.MethodPut,
	}, handlers.UpdateEmailSettings)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "clear-email-settings",
		Summary:     "Clear Email Settings",
		Description: "Remove the outgoing mail relay. Unbind stops sending email.",
		Path:        "/email/clear",
		Method:      http.MethodDelete,
	}, handlers.ClearEmailSettings)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-network-settings",
		Summary:     "Get Network Settings",
		Description: "Get whether teams are isolated from each other on the network, and the exceptions that let a service accept connections from outside its team.",
		Path:        "/network/get",
		Method:      http.MethodGet,
	}, handlers.GetNetworkSettings)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-network-settings",
		Summary:     "Update Network Settings",
		Description: "Turn team network isolation on or off. With it on, services only accept connections from their own team, the system and network exceptions.",
		Path:        "/network/update",
		Method:      http.MethodPut,
	}, handlers.UpdateNetworkSettings)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-network-services",
		Summary:     "List Network Services",
		Description: "List every service in every team, to pick the source and target of a network exception.",
		Path:        "/network/services",
		Method:      http.MethodGet,
	}, handlers.ListNetworkServices)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-network-exception",
		Summary:     "Create Network Exception",
		Description: "Let a service accept connections from a service in another team, or from every source.",
		Path:        "/network/exceptions/create",
		Method:      http.MethodPost,
	}, handlers.CreateNetworkException)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-network-exception",
		Summary:     "Delete Network Exception",
		Description: "Remove a network exception. The connections it allowed are refused while team network isolation is on.",
		Path:        "/network/exceptions/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteNetworkException)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "send-test-email",
		Summary:     "Send Test Email",
		Description: "Send a test message to your own address through the configured relay.",
		Path:        "/email/test",
		Method:      http.MethodPost,
	}, handlers.SendTestEmail)
}
