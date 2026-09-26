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
	"github.com/unbindapp/unbind-api/ent/githubapp"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	github_repo "github.com/unbindapp/unbind-api/internal/repositories/github"
)

type GitHubAppCreateInput struct {
	server.BaseAuthInput
	RedirectURL  string    `query:"redirect_url" required:"true" doc:"The client URL to redirect to after the installation is finished"`
	Organization string    `query:"organization" doc:"The organization to install the app for, if any"`
	TeamID       uuid.UUID `query:"team_id" format:"uuid" doc:"Share the app with this team so its members can pick the repositories. Needs editor access to the team."`
}

type GithubAppCreateResponse struct {
	Body struct {
		Data string `json:"data"`
	}
}

// Handler to render GitHub page with form submission
func (self *HandlerGroup) HandleGithubAppCreate(ctx context.Context, input *GitHubAppCreateInput) (*GithubAppCreateResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}
	if input.TeamID != uuid.Nil {
		if err := self.checkTeam(ctx, user.ID, input.TeamID, schema.ActionEditor); err != nil {
			return nil, err
		}
	}

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

	redirect, err := utils.JoinURLPaths(self.srv.Cfg.ExternalAPIURL, "/github/app/save")
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to build the GitHub redirect URL"))
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
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to create the GitHub app manifest"))
	}

	err = self.srv.StringCache.SetWithExpiration(ctx, appName, state, 30*time.Minute)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to store the GitHub app state"))
	}
	err = self.srv.StringCache.SetWithExpiration(ctx, state, user.ID.String(), 30*time.Minute)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to store the requesting user"))
	}
	if input.Organization != "" {
		err = self.srv.StringCache.SetWithExpiration(ctx, state+"-org", input.Organization, 30*time.Minute)
		if err != nil {
			return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to store the GitHub organization"))
		}
	}
	if input.TeamID != uuid.Nil {
		err = self.srv.StringCache.SetWithExpiration(ctx, state+"-team", input.TeamID.String(), 30*time.Minute)
		if err != nil {
			return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to store the team to share the GitHub app with"))
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

	type templateData struct {
		PostURL      string
		ManifestJSON template.JS
	}

	manifestJSON, err := json.Marshal(manifest)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to prepare the GitHub app manifest"))
	}

	data := templateData{
		PostURL:      githubUrl,
		ManifestJSON: template.JS(string(manifestJSON)),
	}

	t, err := template.New("github-form").Parse(tmpl)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to render the GitHub redirect page"))
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to render the GitHub redirect page"))
	}

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
	Owned  bool      `query:"owned" doc:"Only the apps the caller connected"`
	TeamID uuid.UUID `query:"team_id" format:"uuid" doc:"Only the apps shared with this team. Service counts are then limited to the team."`
}

type GithubAppListResponse struct {
	Body struct {
		Data []*GithubAppAPIResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) HandleListGithubApps(ctx context.Context, input *GithubAppListInput) (*GithubAppListResponse, error) {
	user, visibility, err := self.visibility(ctx)
	if err != nil {
		return nil, err
	}
	var teamID *uuid.UUID
	if input.TeamID != uuid.Nil {
		if err := self.checkTeam(ctx, user.ID, input.TeamID, schema.ActionViewer); err != nil {
			return nil, err
		}
		teamID = &input.TeamID
	}

	apps, err := self.srv.Repository.Github().GetVisibleApps(ctx, visibility, github_repo.AppFilter{OwnedOnly: input.Owned, TeamID: teamID})
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to list the GitHub apps"))
	}
	counts, err := self.serviceCounts(ctx, apps, teamID)
	if err != nil {
		return nil, err
	}

	resp := &GithubAppListResponse{}
	resp.Body.Data = transformGithubAppEntities(apps, counts)
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
	_, visibility, err := self.visibility(ctx)
	if err != nil {
		return nil, err
	}

	app, err := self.srv.Repository.Github().GetVisibleAppByUUID(ctx, visibility, input.UUID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("App not found")
		}
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub app"))
	}
	counts, err := self.serviceCounts(ctx, []*ent.GithubApp{app}, nil)
	if err != nil {
		return nil, err
	}

	resp := &GithubAppGetResponse{}
	resp.Body.Data = transformGithubAppEntity(app, counts)
	return resp, nil
}

// PUT app team
type GithubAppSetTeamInput struct {
	server.BaseAuthInput
	Body struct {
		UUID   uuid.UUID  `json:"uuid" required:"true" format:"uuid"`
		TeamID *uuid.UUID `json:"team_id,omitempty" nullable:"true" doc:"The team to share the app with, omit or send null to make it private to its creator"`
	}
}

type GithubAppSetTeamResponse struct {
	Body struct {
		Data *GithubAppAPIResponse `json:"data"`
	}
}

func (self *HandlerGroup) HandleSetGithubAppTeam(ctx context.Context, input *GithubAppSetTeamInput) (*GithubAppSetTeamResponse, error) {
	user, visibility, err := self.visibility(ctx)
	if err != nil {
		return nil, err
	}

	app, err := self.srv.Repository.Github().GetVisibleAppByUUID(ctx, visibility, input.Body.UUID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("App not found")
		}
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub app"))
	}

	isCreator := app.CreatedBy != nil && *app.CreatedBy == user.ID
	switch {
	case isCreator && input.Body.TeamID != nil:
		if err := self.checkTeam(ctx, user.ID, *input.Body.TeamID, schema.ActionEditor); err != nil {
			return nil, err
		}
	case isCreator:
	case input.Body.TeamID == nil && app.TeamID != nil:
		if err := self.checkTeam(ctx, user.ID, *app.TeamID, schema.ActionEditor); err != nil {
			return nil, err
		}
	default:
		return nil, huma.Error403Forbidden("Only the user who connected the app can share it")
	}

	if _, err := self.srv.Repository.Github().SetAppTeam(ctx, app.ID, input.Body.TeamID); err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to update the GitHub app's team"))
	}
	updated, err := self.srv.Repository.Github().GetGithubAppByUUID(ctx, input.Body.UUID)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub app"))
	}
	counts, err := self.serviceCounts(ctx, []*ent.GithubApp{updated}, nil)
	if err != nil {
		return nil, err
	}

	resp := &GithubAppSetTeamResponse{}
	resp.Body.Data = transformGithubAppEntity(updated, counts)
	return resp, nil
}

// DELETE app
type GithubAppDeleteInput struct {
	server.BaseAuthInput
	Body struct {
		UUID uuid.UUID `json:"uuid" required:"true" format:"uuid"`
	}
}

type GithubAppDeleteResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) HandleDeleteGithubApp(ctx context.Context, input *GithubAppDeleteInput) (*GithubAppDeleteResponse, error) {
	user, visibility, err := self.visibility(ctx)
	if err != nil {
		return nil, err
	}

	app, err := self.srv.Repository.Github().GetVisibleAppByUUID(ctx, visibility, input.Body.UUID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("App not found")
		}
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub app"))
	}
	if err := self.canManage(ctx, user, app); err != nil {
		return nil, err
	}

	for _, installation := range app.Edges.Installations {
		if err := self.srv.GithubClient.DeleteInstallation(ctx, app, installation.ID); err != nil {
			log.Warnf("Failed to uninstall GitHub app %s from %s: %v", app.Name, installation.AccountLogin, err)
		}
	}
	if err := self.srv.Repository.Github().DeleteApp(ctx, app.ID); err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to delete the GitHub app"))
	}

	resp := &GithubAppDeleteResponse{}
	resp.Body.Data = server.DeletedResponse{ID: input.Body.UUID.String(), Deleted: true}
	return resp, nil
}

func (self *HandlerGroup) serviceCounts(ctx context.Context, apps []*ent.GithubApp, teamID *uuid.UUID) (map[int64]int, error) {
	installationIDs := []int64{}
	for _, app := range apps {
		for _, installation := range app.Edges.Installations {
			installationIDs = append(installationIDs, installation.ID)
		}
	}
	counts, err := self.srv.Repository.Github().CountServicesByInstallation(ctx, installationIDs, teamID)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to count the services built from GitHub"))
	}
	return counts, nil
}

func transformGithubAppEntity(entity *ent.GithubApp, serviceCounts map[int64]int) *GithubAppAPIResponse {
	installations := []*GithubInstallationAPIResponse{}
	for _, installation := range entity.Edges.Installations {
		installation.Edges.GithubApp = entity
		installations = append(installations, transformGithubInstallationEntity(installation, serviceCounts[installation.ID]))
	}

	resp := &GithubAppAPIResponse{
		ID:            entity.ID,
		UUID:          entity.UUID,
		CreatedAt:     entity.CreatedAt,
		UpdatedAt:     entity.UpdatedAt,
		CreatedBy:     entity.CreatedBy,
		TeamID:        entity.TeamID,
		Name:          entity.Name,
		OwnerLogin:    entity.OwnerLogin,
		OwnerType:     entity.OwnerType,
		Installations: installations,
	}
	if entity.Edges.Users != nil {
		resp.CreatedByEmail = new(entity.Edges.Users.Email)
	}
	if entity.Edges.Team != nil {
		resp.TeamName = new(entity.Edges.Team.Name)
	}
	return resp
}

func transformGithubAppEntities(entities []*ent.GithubApp, serviceCounts map[int64]int) []*GithubAppAPIResponse {
	result := make([]*GithubAppAPIResponse, len(entities))
	for i, entity := range entities {
		result[i] = transformGithubAppEntity(entity, serviceCounts)
	}
	return result
}

type GithubAppAPIResponse struct {
	// The GitHub App ID
	ID   int64     `json:"id"`
	UUID uuid.UUID `json:"uuid"`
	// The time at which the entity was created.
	CreatedAt time.Time `json:"created_at"`
	// The time at which the entity was last updated.
	UpdatedAt time.Time `json:"updated_at"`
	// The user that connected this app, unset once that user is deleted.
	CreatedBy      *uuid.UUID `json:"created_by,omitempty"`
	CreatedByEmail *string    `json:"created_by_email,omitempty"`
	// The team the app is shared with, unset when only its creator can use it.
	TeamID   *uuid.UUID `json:"team_id,omitempty"`
	TeamName *string    `json:"team_name,omitempty"`
	// Name of the GitHub App
	Name string `json:"name"`
	// The GitHub account that owns the app, empty until it has been read from GitHub
	OwnerLogin    string                           `json:"owner_login"`
	OwnerType     githubapp.OwnerType              `json:"owner_type,omitempty" enum:"Organization,User"`
	Installations []*GithubInstallationAPIResponse `json:"installations" nullable:"false"`
}
