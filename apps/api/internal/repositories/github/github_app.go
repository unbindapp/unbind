package github_repo

import (
	"context"

	"github.com/google/go-github/v69/github"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubapp"
)

// GetApp returns the GithubApp entity., ent.NotFoundError if not found.s
func (self *GithubRepository) GetApp(ctx context.Context) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.Query().First(ctx)
}

// Get all github apps returns a slice of GithubApp entities.
func (self *GithubRepository) GetApps(ctx context.Context, withInstallations bool) ([]*ent.GithubApp, error) {
	q := self.base.DB.GithubApp.Query()
	if withInstallations {
		q.WithInstallations()
	}
	return q.All(ctx)
}

func (self *GithubRepository) CreateApp(ctx context.Context, uniqueUuid uuid.UUID, app *github.AppConfig, createdBy uuid.UUID) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.Create().
		SetID(app.GetID()).
		SetUUID(uniqueUuid).
		SetClientID(app.GetClientID()).
		SetClientSecret(app.GetClientSecret()).
		SetWebhookSecret(app.GetWebhookSecret()).
		SetPrivateKey(app.GetPEM()).
		SetName(app.GetName()).
		SetCreatedBy(createdBy).
		Save(ctx)
}

func (self *GithubRepository) GetGithubAppByID(ctx context.Context, ID int64) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.Query().Where(githubapp.ID(ID)).Only(ctx)
}

func (self *GithubRepository) GetGithubAppByUUID(ctx context.Context, ID uuid.UUID) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.Query().Where(githubapp.UUID(ID)).WithInstallations().Only(ctx)
}
