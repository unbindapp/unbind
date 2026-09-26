package github

import (
	"context"
	"fmt"
	"net/http"
	"time"

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

// GetAppOwner reads which GitHub account owns the app
func (self *GithubClient) GetAppOwner(ctx context.Context, app *ent.GithubApp) (login string, ownerType githubapp.OwnerType, err error) {
	client, err := self.getAppClient(app.ID, app.PrivateKey)
	if err != nil {
		return "", "", err
	}
	defer client.Client().CloseIdleConnections()

	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	ghApp, _, err := client.Apps.Get(timeoutCtx, "")
	if err != nil {
		return "", "", err
	}
	owner := ghApp.GetOwner()
	if owner == nil || owner.GetLogin() == "" {
		return "", "", fmt.Errorf("GitHub returned no owner for app %s", app.Name)
	}
	ownerType = githubapp.OwnerType(owner.GetType())
	if err := githubapp.OwnerTypeValidator(ownerType); err != nil {
		return "", "", err
	}
	return owner.GetLogin(), ownerType, nil
}

// SyncAppOwners fills in the owner of apps connected before it was stored
func (self *GithubClient) SyncAppOwners(ctx context.Context, apps []*ent.GithubApp, save func(ctx context.Context, app *ent.GithubApp, login string, ownerType githubapp.OwnerType) error) {
	for _, app := range apps {
		if app.OwnerLogin != "" {
			continue
		}
		login, ownerType, err := self.GetAppOwner(ctx, app)
		if err != nil {
			log.Warnf("Failed to read the owner of GitHub app %s (%d): %v", app.Name, app.ID, err)
			continue
		}
		if err := save(ctx, app, login, ownerType); err != nil {
			log.Warnf("Failed to store the owner of GitHub app %s (%d): %v", app.Name, app.ID, err)
		}
	}
}
