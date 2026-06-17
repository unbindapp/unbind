package storage_handler

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

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "test-s3-access",
		Summary:     "Test S3 Access",
		Description: "Validate S3 credentials by connecting to the bucket. Read-only against the remote, but reaches an external endpoint.",
		Path:        "/s3/test",
		Method:      http.MethodPost,
	}, handlers.TestS3Access, oapi.OpenWorld)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-s3-source",
		Summary:     "Create S3 Source",
		Description: "Store an S3 source (endpoint + credentials) for use as a backup target.",
		Path:        "/s3/create",
		Method:      http.MethodPost,
	}, handlers.CreateS3, oapi.OpenWorld)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-s3-source",
		Summary:     "Update S3 Source",
		Description: "Update an S3 source's endpoint or credentials.",
		Path:        "/s3/update",
		Method:      http.MethodPost,
	}, handlers.UpdateS3Source, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-s3-source-by-id",
		Summary:     "Get S3 Source",
		Description: "Get a single S3 source by ID. Secret keys are not returned.",
		Path:        "/s3/get",
		Method:      http.MethodGet,
	}, handlers.GetS3SourceByID)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-s3-sources",
		Summary:     "List S3 Sources",
		Description: "List all S3 sources for a team.",
		Path:        "/s3/list",
		Method:      http.MethodGet,
	}, handlers.ListS3Source)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-s3-source",
		Summary:     "Delete S3 Source",
		Description: "Delete an S3 source.",
		Path:        "/s3/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteS3Source)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-pvc",
		Summary:     "List PVCs",
		Description: "List persistent volume claims for a team, project, or environment.",
		Path:        "/pvc/list",
		Method:      http.MethodGet,
	}, handlers.ListPVCs)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-pvc",
		Summary:     "Get PVC",
		Description: "Get a single persistent volume claim by name.",
		Path:        "/pvc/get",
		Method:      http.MethodGet,
	}, handlers.GetPVC)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-pvc",
		Summary:     "Create PVC",
		Description: "Create a persistent volume claim.",
		Path:        "/pvc/create",
		Method:      http.MethodPost,
	}, handlers.CreatePVC)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-pvc",
		Summary:     "Update PVC",
		Description: "Update a persistent volume claim, e.g. grow its capacity.",
		Path:        "/pvc/update",
		Method:      http.MethodPut,
	}, handlers.UpdatePVC)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-pvc",
		Summary:     "Delete PVC",
		Description: "Delete a persistent volume claim and its data. Fails while the volume is mounted by a service.",
		Path:        "/pvc/delete",
		Method:      http.MethodDelete,
	}, handlers.DeletePVC)
}
