package github

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubapp"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// DeleteInstallation uninstalls the app from the account on GitHub, an installation that is already gone counts as deleted
func (self *GithubClient) DeleteInstallation(ctx context.Context, app *ent.GithubApp, installationID int64) error {
	client, err := self.getAppClient(app.ID, app.PrivateKey)
	if err != nil {
		return err
	}
	defer client.Client().CloseIdleConnections()

	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	resp, err := client.Apps.DeleteInstallation(timeoutCtx, installationID)
	if err == nil {
		return nil
	}
	if resp != nil && resp.StatusCode == http.StatusNotFound {
		return nil
	}
	return fmt.Errorf("failed to delete installation %d of app %s: %w", installationID, app.Name, err)
}

// GetApp reads the app as GitHub has it now
func (self *GithubClient) GetApp(ctx context.Context, app *ent.GithubApp) (*github.App, error) {
	client, err := self.getAppClient(app.ID, app.PrivateKey)
	if err != nil {
		return nil, err
	}
	defer client.Client().CloseIdleConnections()

	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	ghApp, _, err := client.Apps.Get(timeoutCtx, "")
	if err != nil {
		return nil, err
	}
	return ghApp, nil
}

// SyncApps saves the name, slug and owner of apps that were renamed or transferred on GitHub
func (self *GithubClient) SyncApps(ctx context.Context, apps []*ent.GithubApp, save func(ctx context.Context, app *ent.GithubApp, ghApp *github.App) error) {
	for _, app := range apps {
		ghApp, err := self.GetApp(ctx, app)
		if err != nil {
			log.Warnf("Failed to read GitHub app %s (%d): %v", app.Name, app.ID, err)
			continue
		}
		if !changedOnGithub(app, ghApp) {
			continue
		}
		if err := save(ctx, app, ghApp); err != nil {
			log.Warnf("Failed to store the changes of GitHub app %s (%d): %v", app.Name, app.ID, err)
		}
	}
}

func changedOnGithub(app *ent.GithubApp, ghApp *github.App) bool {
	owner := ghApp.GetOwner()
	return ghApp.GetName() != app.Name ||
		ghApp.GetSlug() != app.Slug ||
		owner.GetLogin() != app.OwnerLogin ||
		githubapp.OwnerType(owner.GetType()) != app.OwnerType
}
