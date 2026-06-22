package servicegroups_handler

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
		OperationID: "list-service-groups",
		Summary:     "List Service Groups",
		Description: "List all service groups in an environment.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListServiceGroups)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-service-group",
		Summary:     "Get Service Group",
		Description: "Get a single service group by ID.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetServiceGroup)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-service-group-info",
		Summary:     "Get Service Group Info",
		Description: "Get a template-creation-screen style summary of a deployed service group, with labeled hosts and variables.",
		Path:        "/info",
		Method:      http.MethodGet,
	}, handlers.GetServiceGroupInfo)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-service-group-template-inputs",
		Summary:     "Get Service Group Template Inputs",
		Description: "Get the deployed template's inputs in order with current values. Only valid for template-deployed groups.",
		Path:        "/template-inputs",
		Method:      http.MethodGet,
	}, handlers.GetServiceGroupTemplateInputs)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-service-group-template-inputs",
		Summary:     "Update Service Group Template Inputs",
		Description: "Edit a deployed template's inputs (domains, sizes, variables), re-applying to the underlying services.",
		Path:        "/template-inputs",
		Method:      http.MethodPut,
	}, handlers.UpdateServiceGroupTemplateInputs)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-service-group",
		Summary:     "Create Service Group",
		Description: "Create a service group to organize services within an environment.",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateServiceGroup)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-service-group",
		Summary:     "Update Service Group",
		Description: "Update a service group's name, icon, or members.",
		Path:        "/update",
		Method:      http.MethodPut,
	}, handlers.UpdateServiceGroup)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-service-group",
		Summary:     "Delete Service Group",
		Description: "Delete a service group. Optionally deletes the services it contains.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteServiceGroup)
}
