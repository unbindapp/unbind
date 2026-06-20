package docker_handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

const dockerHubAPI = "https://hub.docker.com"

// * Search
type SearchImagesInput struct {
	server.BaseAuthInput
	Query string `query:"query" description:"Search term to match against image names"`
}

type DockerImage struct {
	RepoName  string `json:"repo_name"`
	PullCount int64  `json:"pull_count"`
}

type SearchImagesResponse struct {
	Body struct {
		Data []DockerImage `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) SearchImages(ctx context.Context, input *SearchImagesInput) (*SearchImagesResponse, error) {
	query := input.Query
	if query == "" {
		query = "a"
	}

	endpoint := fmt.Sprintf("%s/v2/search/repositories/?page_size=50&query=%s", dockerHubAPI, url.QueryEscape(query))

	var payload struct {
		Results []DockerImage `json:"results"`
	}
	if err := self.getJSON(ctx, endpoint, &payload); err != nil {
		log.Error("Error searching Docker Hub", "err", err)
		return nil, huma.Error502BadGateway("Failed to search Docker Hub")
	}

	resp := &SearchImagesResponse{}
	resp.Body.Data = payload.Results
	if resp.Body.Data == nil {
		resp.Body.Data = []DockerImage{}
	}
	return resp, nil
}

// * Tags
type ListTagsInput struct {
	server.BaseAuthInput
	Repository string `query:"repository" required:"true" description:"Image repository, e.g. 'nginx' or 'bitnami/redis'"`
	Search     string `query:"search" description:"Filter tags by name"`
}

type DockerTag struct {
	Name          string  `json:"name"`
	TagLastPushed *string `json:"tag_last_pushed,omitempty"`
	FullSize      *int64  `json:"full_size,omitempty"`
}

type ListTagsResponse struct {
	Body struct {
		Data []DockerTag `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListTags(ctx context.Context, input *ListTagsInput) (*ListTagsResponse, error) {
	// Official images live under the implicit "library" namespace.
	namespace, name := "library", input.Repository
	if idx := strings.Index(input.Repository, "/"); idx != -1 {
		namespace, name = input.Repository[:idx], input.Repository[idx+1:]
	}

	endpoint := fmt.Sprintf("%s/v2/repositories/%s/%s/tags/?page_size=50", dockerHubAPI, url.PathEscape(namespace), url.PathEscape(name))
	if input.Search != "" {
		endpoint += "&name=" + url.QueryEscape(input.Search)
	}

	var payload struct {
		Results []DockerTag `json:"results"`
	}
	if err := self.getJSON(ctx, endpoint, &payload); err != nil {
		log.Error("Error listing Docker Hub tags", "err", err)
		return nil, huma.Error502BadGateway("Failed to list Docker Hub tags")
	}

	resp := &ListTagsResponse{}
	resp.Body.Data = payload.Results
	if resp.Body.Data == nil {
		resp.Body.Data = []DockerTag{}
	}
	return resp, nil
}

func (self *HandlerGroup) getJSON(ctx context.Context, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}

	res, err := self.srv.HttpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("docker hub returned status %d", res.StatusCode)
	}

	return json.NewDecoder(res.Body).Decode(out)
}
