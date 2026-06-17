package github_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubapp"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func (self *GithubRepository) GetInstallationByID(ctx context.Context, ID int64) (*ent.GithubInstallation, error) {
	return self.base.DB.GithubInstallation.Query().Where(githubinstallation.ID(ID)).WithGithubApp().Only(ctx)
}

func (self *GithubRepository) GetInstallationsByCreator(ctx context.Context, createdBy uuid.UUID) ([]*ent.GithubInstallation, error) {
	return self.base.DB.GithubApp.Query().
		Where(githubapp.CreatedByEQ(createdBy)).
		QueryInstallations().
		WithGithubApp().All(ctx)
}

func (self *GithubRepository) GetInstallationsByAppID(ctx context.Context, appID int64) ([]*ent.GithubInstallation, error) {
	return self.base.DB.GithubInstallation.Query().Where(githubinstallation.GithubAppID(appID)).All(ctx)
}

func (self *GithubRepository) UpsertInstallation(
	ctx context.Context,
	id int64,
	appID int64,
	accountID int64,
	accountLogin string,
	accountType githubinstallation.AccountType,
	accountURL string,
	repositorySelection githubinstallation.RepositorySelection,
	suspended bool,
	active bool,
	permissions schema.GithubInstallationPermissions,
	events []string,
) (*ent.GithubInstallation, error) {
	err := self.base.DB.GithubInstallation.Create().
		SetID(id).
		SetGithubAppID(appID).
		SetAccountID(accountID).
		SetAccountLogin(accountLogin).
		SetAccountType(accountType).
		SetAccountURL(accountURL).
		SetRepositorySelection(repositorySelection).
		SetSuspended(suspended).
		SetActive(active).
		SetPermissions(permissions).
		SetEvents(events).
		OnConflictColumns(
			githubinstallation.FieldID,
		).
		UpdateNewValues().
		Exec(ctx)
	if err != nil {
		return nil, err
	}

	return self.base.DB.GithubInstallation.Query().Where(githubinstallation.ID(id)).Only(ctx)
}

func (self *GithubRepository) SetInstallationActive(ctx context.Context, id int64, active bool) (*ent.GithubInstallation, error) {
	return self.base.DB.GithubInstallation.UpdateOneID(id).
		SetActive(active).
		Save(ctx)
}

func (self *GithubRepository) SetInstallationSuspended(ctx context.Context, id int64, suspended bool) (*ent.GithubInstallation, error) {
	return self.base.DB.GithubInstallation.UpdateOneID(id).
		SetSuspended(suspended).
		Save(ctx)
}
