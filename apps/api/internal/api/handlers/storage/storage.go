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
		Description: "Validate S3 credentials that are not stored yet by writing and deleting a probe object in the bucket. Reaches an external endpoint.",
		Path:        "/s3/test",
		Method:      http.MethodPost,
	}, handlers.TestS3Access, oapi.OpenWorld, oapi.NoMCP("S3 credentials should not pass through a model conversation"))

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "test-stored-s3-bucket",
		Summary:     "Test Stored S3 Bucket",
		Description: "Check that a stored S3 bucket is still reachable with its saved credentials, by writing and deleting a probe object in it. Returns valid=false with the error when it is not. Use it when backups to the bucket fail. Reaches an external endpoint.",
		Path:        "/s3/test-stored",
		Method:      http.MethodPost,
	}, handlers.TestStoredS3Bucket, oapi.OpenWorld, oapi.MCP)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-s3-bucket",
		Summary:     "Create S3 Bucket",
		Description: "Store an S3 bucket (endpoint, bucket and credentials) for use as a backup target.",
		Path:        "/s3/create",
		Method:      http.MethodPost,
	}, handlers.CreateS3Bucket, oapi.OpenWorld, oapi.NoMCP("S3 credentials should not pass through a model conversation"))

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-s3-bucket",
		Summary:     "Update S3 Bucket",
		Description: "Update an S3 bucket's name, endpoint, region, bucket or credentials.",
		Path:        "/s3/update",
		Method:      http.MethodPost,
	}, handlers.UpdateS3Bucket, oapi.OpenWorld, oapi.NoMCP("S3 credentials should not pass through a model conversation"))

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-s3-bucket-by-id",
		Summary:     "Get S3 Bucket",
		Description: "Get a single S3 bucket by ID: its name, endpoint, region, bucket and access key ID. The secret key is never returned.",
		Path:        "/s3/get",
		Method:      http.MethodGet,
	}, handlers.GetS3BucketByID, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-s3-buckets",
		Summary:     "List S3 Buckets",
		Description: "List the S3 buckets stored for a team. Database services back up to one of them, picked by its ID through s3_backup_bucket_id. The secret key is never returned.",
		Path:        "/s3/list",
		Method:      http.MethodGet,
	}, handlers.ListS3Buckets, oapi.MCP)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-s3-bucket",
		Summary:     "Delete S3 Bucket",
		Description: "Delete an S3 bucket.",
		Path:        "/s3/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteS3Bucket, oapi.NoMCP("S3 buckets are managed in the UI"))

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-volumes",
		Summary:     "List Volumes (PVCs)",
		Description: "List volumes (persistent volume claims) for a team, project, or environment.",
		Path:        "/pvc/list",
		Method:      http.MethodGet,
	}, handlers.ListPVCs, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-volume",
		Summary:     "Get Volume (PVC)",
		Description: "Get a single volume (persistent volume claim) by name.",
		Path:        "/pvc/get",
		Method:      http.MethodGet,
	}, handlers.GetPVC, oapi.MCP)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-volume",
		Summary:     "Create Volume (PVC)",
		Description: "Create a volume (persistent volume claim).",
		Path:        "/pvc/create",
		Method:      http.MethodPost,
	}, handlers.CreatePVC, oapi.MCP)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-volume",
		Summary:     "Update Volume (PVC)",
		Description: "Update a volume (persistent volume claim), e.g. grow its capacity.",
		Path:        "/pvc/update",
		Method:      http.MethodPut,
	}, handlers.UpdatePVC, oapi.MCP)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-volume",
		Summary:     "Delete Volume (PVC)",
		Description: "Delete a volume (persistent volume claim) and its data. Fails while the volume is mounted by a service.",
		Path:        "/pvc/delete",
		Method:      http.MethodDelete,
	}, handlers.DeletePVC, oapi.MCP)
}
