package github

import (
	"context"
	"time"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// SyncWebhookURLs points every app's webhook at this instance's receiver. GitHub stores
// the URL when the app is created, so a path change has to be written back.
func (self *GithubClient) SyncWebhookURLs(ctx context.Context, apps []*ent.GithubApp) {
	for _, app := range apps {
		if err := self.syncWebhookURL(ctx, app); err != nil {
			log.Warnf("Failed to update the webhook URL of GitHub app %s (%d): %v", app.Name, app.ID, err)
		}
	}
}

func (self *GithubClient) syncWebhookURL(ctx context.Context, app *ent.GithubApp) error {
	client, err := self.getAppClient(app.ID, app.PrivateKey)
	if err != nil {
		return err
	}
	defer client.Client().CloseIdleConnections()

	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	current, _, err := client.Apps.GetHookConfig(timeoutCtx)
	if err != nil {
		return err
	}
	if current.GetURL() == self.cfg.GithubWebhookURL {
		return nil
	}

	_, _, err = client.Apps.UpdateHookConfig(timeoutCtx, &github.HookConfig{URL: github.Ptr(self.cfg.GithubWebhookURL)})
	if err != nil {
		return err
	}
	log.Infof("Updated the webhook URL of GitHub app %s (%d) from %s", app.Name, app.ID, current.GetURL())
	return nil
}
