package docker_handler

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
		OperationID: "search-docker-images",
		Summary:     "Search Docker Images",
		Description: "Search public images on Docker Hub. Proxies Docker Hub so the browser avoids cross-origin restrictions.",
		Path:        "/search",
		Method:      http.MethodGet,
	}, handlers.SearchImages, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-docker-tags",
		Summary:     "List Docker Image Tags",
		Description: "List tags for a public Docker Hub image. Proxies Docker Hub so the browser avoids cross-origin restrictions.",
		Path:        "/tags",
		Method:      http.MethodGet,
	}, handlers.ListTags, oapi.OpenWorld)
}
