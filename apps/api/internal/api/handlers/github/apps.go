package github_handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"net/url"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

type GitHubAppCreateInput struct {
	server.BaseAuthInput
	RedirectURL  string `query:"redirect_url" required:"true" doc:"The client URL to redirect to after the installation is finished"`
	Organization string `query:"organization" doc:"The organization to install the app for, if any"`
}

type GithubAppCreateResponse struct {
	Body struct {
		Data string `json:"data"`
	}
}

// Handler to render GitHub page with form submission
func (self *HandlerGroup) HandleGithubAppCreate(ctx context.Context, input *GitHubAppCreateInput) (*GithubAppCreateResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	// Template for the GitHub form submission page
	tmpl := `<!DOCTYPE html>
<html>
<head>
    <title>GitHub Form Submit</title>
</head>
<body>
    <script>
        const data = {
            post_url: "{{.PostURL}}",
            manifest: {{.ManifestJSON}}
        };
        const form = document.createElement("form");
        form.method = "post";
        form.action = data.post_url;
        form.style.display = "none";
        
        const input = document.createElement("input");
        input.name = "manifest";
        input.type = "text";
        input.value = JSON.stringify(data.manifest);
        
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
    </script>
</body>
</html>`

	// Build redirect
	redirect, err := utils.JoinURLPaths(self.srv.Cfg.ExternalAPIURL, "/webhook/github/app/save")
	if err != nil {
		log.Error("Error building redirect URL", "err", err)
		return nil, huma.Error500InternalServerError("Failed to build redirect URL")
	}

	// Create a unique state to identify this request
	state := uuid.New().String()

	// Attach state as ?id to the input redirect URL
	parsedRedirect, err := url.Parse(input.RedirectURL)
	if err != nil {
		log.Error("Error parsing redirect URL", "err", err)
		return nil, huma.Error400BadRequest("Invalid redirect URL")
	}
	inputQ := parsedRedirect.Query()
	inputQ.Set("id", state)
	parsedRedirect.RawQuery = inputQ.Encode()
	input.RedirectURL = parsedRedirect.String()

	// Create GitHub app manifest, if not organization we also want organization read permission
	manifest, appName, err := self.srv.GithubClient.CreateAppManifest(redirect, input.RedirectURL, input.Organization != "")

	if err != nil {
		log.Error("Error creating github app manifest", "err", err)
		return nil, huma.Error500InternalServerError("Failed to create github app manifest")
	}

	err = self.srv.StringCache.SetWithExpiration(ctx, appName, state, 30*time.Minute)
	if err != nil {
		log.Error("Error setting state in cache", "err", err)
		return nil, huma.Error500InternalServerError("Failed to set state in cache")
	}
	// Set a user ID in the cache
	err = self.srv.StringCache.SetWithExpiration(ctx, state, user.ID.String(), 30*time.Minute)
	if err != nil {
		log.Error("Error setting user ID in cache", "err", err)
		return nil, huma.Error500InternalServerError("Failed to set user ID in cache")
	}
	// Set organization in the cache
	if input.Organization != "" {
		err = self.srv.StringCache.SetWithExpiration(ctx, state+"-org", input.Organization, 30*time.Minute)
		if err != nil {
			log.Error("Error setting organization in cache", "err", err)
			return nil, huma.Error500InternalServerError("Failed to set organization in cache")
		}
	}

	q := url.Values{}
	q.Set("state", state)
	githubUrl := self.srv.Cfg.GithubURL
	if input.Organization != "" {
		githubUrl, _ = utils.JoinURLPaths(githubUrl, "organizations", strings.ToLower(input.Organization))
	}
	githubUrl, _ = utils.JoinURLPaths(githubUrl, "settings", "apps", "new")
	githubUrl = fmt.Sprintf("%s?%s", githubUrl, q.Encode())

	// Create template data struct
	type templateData struct {
		PostURL      string
		ManifestJSON template.JS
	}

	// Convert manifest to JSON
	manifestJSON, err := json.Marshal(manifest)
	if err != nil {
		log.Error("Error marshaling manifest to JSON", "err", err)
		return nil, huma.Error500InternalServerError("Failed to prepare manifest data")
	}

	// Create data for template
	data := templateData{
		PostURL:      githubUrl,
		ManifestJSON: template.JS(string(manifestJSON)),
	}

	// Parse and execute the template
	t, err := template.New("github-form").Parse(tmpl)
	if err != nil {
		log.Error("Error parsing template", "err", err)
		return nil, huma.Error500InternalServerError("Failed to parse HTML template")
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		log.Error("Error executing template", "err", err)
		return nil, huma.Error500InternalServerError("Failed to render HTML template")
	}

	// Create response
	return &GithubAppCreateResponse{
		Body: struct {
			Data string `json:"data"`
		}{
			Data: buf.String(),
		},
	}, nil
}

// GET Github apps
type GithubAppListInput struct {
	server.BaseAuthInput
	WithInstallations bool `query:"with_installations"`
}

type GithubAppListResponse struct {
	Body struct {
		Data []*GithubAppAPIResponse `json:"data"`
	}
}

func (self *HandlerGroup) HandleListGithubApps(ctx context.Context, input *GithubAppListInput) (*GithubAppListResponse, error) {
	apps, err := self.srv.Repository.Github().GetApps(ctx, input.WithInstallations)
	if err != nil {
		log.Error("Error getting github apps", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get github apps")
	}

	resp := &GithubAppListResponse{}
	resp.Body.Data = transformGithubAppEntities(apps)
	return resp, nil
}

// GET by UUID
type GithubAppGetInput struct {
	server.BaseAuthInput
	UUID uuid.UUID `query:"uuid" required:"true" format:"uuid"`
}

type GithubAppGetResponse struct {
	Body struct {
		Data *GithubAppAPIResponse `json:"data"`
	}
}

func (self *HandlerGroup) HandleGetGithubApp(ctx context.Context, input *GithubAppGetInput) (*GithubAppGetResponse, error) {
	// Get app by ID
	app, err := self.srv.Repository.Github().GetGithubAppByUUID(ctx, input.UUID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("App not found")
		}
		log.Error("Error getting github app", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get github app")
	}

	resp := &GithubAppGetResponse{}
	resp.Body.Data = transformGithubAppEntity(app)
	return resp, nil
}

func transformGithubAppEntity(entity *ent.GithubApp) *GithubAppAPIResponse {
	installations := []*GithubInstallationAPIResponse{}
	if len(entity.Edges.Installations) > 0 {
		for _, installation := range entity.Edges.Installations {
			// Add app to edge
			installation.Edges.GithubApp = entity
		}
		installations = transformGithubInstallationEntities(entity.Edges.Installations)
	}

	return &GithubAppAPIResponse{
		ID:            entity.ID,
		UUID:          entity.UUID,
		CreatedAt:     entity.CreatedAt,
		UpdatedAt:     entity.UpdatedAt,
		CreatedBy:     entity.CreatedBy,
		Name:          entity.Name,
		Installations: installations,
	}
}

func transformGithubAppEntities(entities []*ent.GithubApp) []*GithubAppAPIResponse {
	result := make([]*GithubAppAPIResponse, len(entities))
	for i, entity := range entities {
		result[i] = transformGithubAppEntity(entity)
	}
	return result
}

type GithubAppAPIResponse struct {
	// ID of the ent.
	// The GitHub App ID
	ID   int64     `json:"id"`
	UUID uuid.UUID `json:"uuid"`
	// The time at which the entity was created.
	CreatedAt time.Time `json:"created_at"`
	// The time at which the entity was last updated.
	UpdatedAt time.Time `json:"updated_at"`
	// The user that created this github app.
	CreatedBy uuid.UUID `json:"created_by"`
	// Name of the GitHub App
	Name          string                           `json:"name"`
	Installations []*GithubInstallationAPIResponse `json:"installations" nullable:"false"`
}
