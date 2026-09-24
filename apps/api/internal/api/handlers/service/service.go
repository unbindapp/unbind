package service_handler

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
		OperationID: "list-service",
		Summary:     "List Services",
		Description: "List all services in an environment.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListServices, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-service",
		Summary:     "Get Service",
		Description: "Get a single service by ID, including its config.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetService, oapi.MCP)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-service",
		Summary:     "Create Service",
		Description: "Create a service from a git repo, container image, or database. Does not deploy it; trigger a deployment separately.",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateService, oapi.OpenWorld, oapi.MCP)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-service",
		Summary:     "Update Service",
		Description: "Update a service's config (source, build, runtime, networking). A running service rolls the change out right away, rebuilding when the source or a build setting changed. A service that was never deployed picks it up on its first deployment.",
		Path:        "/update",
		Method:      http.MethodPut,
	}, handlers.UpdateService, oapi.MCP)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-service",
		Summary:     "Delete Service",
		Description: "Permanently delete a service, its deployments, and its config. Attached volumes are not deleted, they remain in the environment and can be attached to another service. If it was the last service in its service group, the group is deleted too.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteService, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-available-databases",
		Summary:     "List Available Databases",
		Description: "List the database types that can be created as services.",
		Path:        "/databases/installable/list",
		Method:      http.MethodGet,
	}, handlers.ListDatabases, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-database-definition",
		Summary:     "Get Database Definition",
		Description: "Get the full configuration schema for a database type.",
		Path:        "/databases/installable/get",
		Method:      http.MethodGet,
	}, handlers.GetDatabaseDefinition, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-service-endpoints",
		Summary:     "List Service Endpoints",
		Description: "List the internal and external endpoints exposed by a service.",
		Path:        "/endpoints/list",
		Method:      http.MethodGet,
	}, handlers.ListEndpoints, oapi.MCP)
}
