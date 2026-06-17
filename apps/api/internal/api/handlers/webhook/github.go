package webhook_handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/go-github/v69/github"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/deployctl"
)

// Connect the new github app to our instance, via manifest code exchange
type HandleGithubAppSaveInput struct {
	Code  string `query:"code" required:"true"`
	State string `query:"state" required:"true"`
}

type HandleGithubAppSaveResponse struct {
	Status int
	Url    string `header:"Location"`
	Cookie string `header:"Set-Cookie"`
}

// Save github app and redirect to installation
func (self *HandlerGroup) HandleGithubAppSave(ctx context.Context, input *HandleGithubAppSaveInput) (*HandleGithubAppSaveResponse, error) {
	// Exchange the code for tokens.
	appConfig, err := self.srv.GithubClient.ManifestCodeConversion(ctx, input.Code)
	if err != nil {
		return nil, huma.Error500InternalServerError(fmt.Sprintf("Failed to exchange manifest code: %v", err))
	}

	// Verify state
	state, err := self.srv.StringCache.Getdel(ctx, appConfig.GetName())
	if err != nil {
		if err == redis.Nil {
			return nil, huma.Error400BadRequest("Invalid state")
		}
		log.Error("Error getting state from cache", "err", err)
		return nil, huma.Error500InternalServerError(fmt.Sprintf("Failed to get state: %v", err))
	}

	if state != input.State {
		return nil, huma.Error400BadRequest("Invalid state")
	}

	// Parse state as uuid
	parsedState, err := uuid.Parse(state)
	if err != nil {
		log.Error("Error parsing state", "err", err)
		return nil, huma.Error400BadRequest("Failed to parse state")
	}

	// Get user id from cache
	userID, err := self.srv.StringCache.Getdel(ctx, input.State)
	if err != nil {
		if err == redis.Nil {
			return nil, huma.Error400BadRequest("Invalid state")
		}
		log.Error("Error getting user ID from cache", "err", err)
		return nil, huma.Error500InternalServerError(fmt.Sprintf("Failed to get user ID: %v", err))
	}
	userIDParsed, err := uuid.Parse(userID)
	if err != nil {
		log.Error("Error parsing user ID", "err", err)
		return nil, huma.Error500InternalServerError("Failed to determine user ID")
	}

	// Get organization from the cache
	// !  TODO - do we need this? seems like installation URL is the same regardless of org
	_, err = self.srv.StringCache.Getdel(ctx, state+"-org")
	if err != nil && !errors.Is(err, redis.Nil) {
		log.Error("Error getting organization from the cache", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get organization from cache")
	}

	// Save the app config
	ghApp, err := self.srv.Repository.Github().CreateApp(ctx, parsedState, appConfig, userIDParsed)
	if err != nil {
		log.Error("Error saving github app", "err", err)
		return nil, huma.Error500InternalServerError("Failed to save github app")
	}

	// create a cookie that stores the state value
	cookie := &http.Cookie{
		Name:     "github_install_state",
		Value:    state,
		Path:     "/",
		MaxAge:   int(3600),
		Secure:   false,
		HttpOnly: true,
	}

	// Redirect URL - this is where GitHub will send users to install your app
	installationURL := fmt.Sprintf(
		"https://github.com/apps/%s/installations/new?state=%s",
		url.QueryEscape(ghApp.Name),
		url.QueryEscape(state),
	)

	// Delay the redirect because github will 404 otherwise
	time.Sleep(2 * time.Second)

	return &HandleGithubAppSaveResponse{
		Status: http.StatusTemporaryRedirect,
		Url:    installationURL,
		Cookie: cookie.String(),
	}, nil
}

// HandleGithubWebhook handles incoming GitHub webhooks.
type GithubWebhookInput struct {
	RawBody               []byte
	Sha1SignatureHeader   string `header:"X-Hub-Signature"`
	Sha256SignatureHeader string `header:"X-Hub-Signature-256"`
	EventType             string `header:"X-GitHub-Event"`
}

type GithubWebhookOutput struct {
}

func (self *HandlerGroup) HandleGithubWebhook(ctx context.Context, input *GithubWebhookInput) (*GithubWebhookOutput, error) {
	// Since we may have multiple apps, we want to validate against every webhook secret to see if it belongs to any of our apps
	ghApps, err := self.srv.Repository.Github().GetApps(ctx, false)
	if err != nil {
		log.Error("Error getting github apps", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get github apps")
	}
	var ghApp *ent.GithubApp

	// Figure out signature for webhook secret validation
	signature := input.Sha256SignatureHeader
	if signature == "" {
		signature = input.Sha1SignatureHeader
	}

	// Validate the payload using the webhook secret.
	for _, app := range ghApps {
		err := github.ValidateSignature(signature, input.RawBody, []byte(app.WebhookSecret))
		if err == nil {
			ghApp = app
			break
		}
	}

	if ghApp == nil {
		log.Error("Received webhook with invalid signature")
		return nil, huma.Error400BadRequest("Invalid signature")
	}

	// Parse the webhook event.
	event, err := github.ParseWebHook(input.EventType, input.RawBody)
	if err != nil {
		log.Errorf("Could not parse webhook: %v", err)
		return nil, huma.Error400BadRequest("Failed to parse github webhook")
	}

	switch e := event.(type) {
	case *github.InstallationEvent:
		// Common installation data
		installation := e.GetInstallation()
		installationID := installation.GetID()
		account := installation.GetAccount()

		// Check if this event is for our app
		if installation.GetAppID() != ghApp.ID {
			log.Info("Received installation event for different app", "app", e.Installation.GetAppID(), "expected", ghApp.ID)
			return &GithubWebhookOutput{}, nil
		}

		// Determine account type and details
		accountType := githubinstallation.AccountTypeUser
		if strings.EqualFold(account.GetType(), "Organization") {
			accountType = githubinstallation.AccountTypeOrganization
		}

		// Determine repository selection
		repoSelection := githubinstallation.RepositorySelectionAll
		if strings.EqualFold(installation.GetRepositorySelection(), "selected") {
			repoSelection = githubinstallation.RepositorySelectionSelected
		}

		// Process based on action
		switch e.GetAction() {
		case "created", "new_permissions_accepted":
			// Build permissions map
			permissions := schema.GithubInstallationPermissions{}
			if perms := installation.GetPermissions(); perms != nil {
				permissions.Contents = perms.GetContents()
				permissions.Metadata = perms.GetMetadata()
			}

			// Get events
			events := append([]string{}, installation.Events...)

			// Create or update installation in database
			_, err = self.srv.Repository.Github().UpsertInstallation(
				ctx,
				installationID,
				installation.GetAppID(),
				account.GetID(),
				account.GetLogin(),
				accountType,
				account.GetHTMLURL(),
				repoSelection,
				installation.SuspendedAt != nil,
				true,
				permissions,
				events,
			)

			if err != nil {
				log.Error("Error upserting github installation", "err", err)
				return nil, huma.Error500InternalServerError("Failed to upsert github installation")
			}

		case "deleted":
			// Mark as inactive instead of deleting
			_, err := self.srv.Repository.Github().SetInstallationActive(ctx, installationID, false)
			if err != nil {
				log.Error("Error setting installation as inactive", "err", err)
				return nil, huma.Error500InternalServerError("Failed to set installation as inactive")
			}

		case "suspended":
			_, err := self.srv.Repository.Github().SetInstallationSuspended(ctx, installationID, true)
			if err != nil {
				log.Error("Error setting installation as suspended", "err", err)
				return nil, huma.Error500InternalServerError("Failed to set installation as suspended")
			}

		case "unsuspended":
			_, err := self.srv.Repository.Github().SetInstallationSuspended(ctx, installationID, false)
			if err != nil {
				log.Error("Error setting installation as unsuspended", "err", err)
				return nil, huma.Error500InternalServerError("Failed to set installation as unsuspended")
			}
		}
	case *github.PushEvent:
		// Trigger a build if the push event is for a branch we care about
		if e.Repo == nil || e.Installation == nil {
			log.Errorf("Received push event with missing repo or installation %v", e)
			return &GithubWebhookOutput{}, nil
		}

		// Get info
		sender := e.GetSender()
		headCommit := e.GetHeadCommit()
		var committer *schema.GitCommitter
		var commitSHA string
		var commitMessage string

		if sender != nil {
			committer = &schema.GitCommitter{
				Name:      sender.GetLogin(),
				AvatarURL: sender.GetAvatarURL(),
			}
		}

		if headCommit != nil {
			commitSHA = headCommit.GetID()
			commitMessage = headCommit.GetMessage()
		}

		repoName := e.Repo.GetName()
		repoUrl := e.Repo.GetCloneURL()
		installationID := e.Installation.GetID()
		ref := e.GetRef()

		// Get the installation
		installation, err := self.srv.Repository.Github().GetInstallationByID(ctx, installationID)
		if err != nil {
			if ent.IsNotFound(err) {
				log.Info("Received event for installation not found in DB", "id", installationID)
				return &GithubWebhookOutput{}, nil
			}
			log.Error("Error getting installation", "err", err)
			return nil, huma.Error500InternalServerError("Failed to get installation")
		}

		// Get the services associated with this installation and repo
		services, err := self.srv.Repository.Service().GetByInstallationIDAndRepoName(ctx, installation.ID, repoName)
		if err != nil {
			log.Error("Error getting services", "err", err)
			return nil, huma.Error500InternalServerError("Failed to get services")
		}

		servicesToBuild := make([]*ent.Service, 0)
		for _, service := range services {
			config := service.Edges.ServiceConfig

			// Handle tag pushes
			if strings.HasPrefix(ref, "refs/tags/") {
				if config.GitTag == nil {
					continue
				}
				tagName := strings.TrimPrefix(ref, "refs/tags/")
				matched := utils.MatchesGlobPattern(tagName, *config.GitTag)
				if matched {
					servicesToBuild = append(servicesToBuild, service)
				}
				continue
			}

			// Handle branch pushes
			var refToBuild *string
			if config.GitBranch != nil {
				if !strings.Contains(*config.GitBranch, "refs/heads/") {
					refToBuild = utils.ToPtr("refs/heads/" + *config.GitBranch)
				}
			}

			if refToBuild != nil && *refToBuild == ref {
				servicesToBuild = append(servicesToBuild, service)
			}
		}

		if len(servicesToBuild) == 0 {
			// Nothing to do
			return &GithubWebhookOutput{}, nil
		}

		// Get the tag name if this is a tag push
		var tagName *string
		if strings.HasPrefix(ref, "refs/tags/") {
			tag := strings.TrimPrefix(ref, "refs/tags/")
			tagName = &tag
		}

		// Trigger builds for each service
		for _, service := range servicesToBuild {
			if !service.Edges.ServiceConfig.AutoDeploy {
				// Skip services that don't have auto-deploy enabled
				continue
			}

			env, err := self.srv.DeploymentController.PopulateBuildEnvironment(ctx, service.ID, tagName, nil)
			if err != nil {
				log.Error("Error populating build environment", "err", err)
				return nil, huma.Error500InternalServerError("Failed to populate build environment")
			}

			log.Info("Enqueuing build", "repo", repoName, "branch", ref, "serviceID", service.ID, "installationID", installationID, "appID", installation.GithubAppID, "repoUrl", repoUrl)
			req := deployctl.DeploymentJobRequest{
				ServiceID:     service.ID,
				Environment:   env,
				Source:        schema.DeploymentSourceGit,
				CommitSHA:     commitSHA,
				CommitMessage: commitMessage,
				GitBranch:     ref,
				Committer:     committer,
			}
			jobID, err := self.srv.DeploymentController.EnqueueDeploymentJob(
				ctx,
				req,
			)

			if err != nil {
				log.Error("Error enqueuing build job", "err", err)
				return nil, huma.Error500InternalServerError("Failed to enqueue build job")
			}

			log.Info("Enqueued build job", "jobID", jobID)
		}
	}

	return &GithubWebhookOutput{}, nil
}
