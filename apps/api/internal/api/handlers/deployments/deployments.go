package deployments_handler

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
		OperationID: "list-deployments",
		Summary:     "List Deployments",
		Description: "List deployments for a service, newest first.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListDeployments)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-deployment",
		Summary:     "Get Deployment",
		Description: "Get a single deployment by ID, including its build/run status.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetDeploymentByID)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "trigger-deployment",
		Summary:     "Trigger Deployment",
		Description: "Build and deploy the service's current source. Queues an asynchronous build; poll the returned deployment for status.",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateDeployment, oapi.OpenWorld)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "redeploy-deployment",
		Summary:     "Redeploy Deployment",
		Description: "Re-run an existing deployment's build and roll it out again.",
		Path:        "/redeploy",
		Method:      http.MethodPost,
	}, handlers.CreateNewRedeployment, oapi.OpenWorld)
}
