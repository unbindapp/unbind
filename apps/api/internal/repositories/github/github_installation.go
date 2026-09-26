package github_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/project"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
)

func (self *GithubRepository) GetInstallationByID(ctx context.Context, ID int64) (*ent.GithubInstallation, error) {
	return self.base.DB.GithubInstallation.Query().Where(githubinstallation.ID(ID)).WithGithubApp().Only(ctx)
}

func (self *GithubRepository) GetInstallations(ctx context.Context) ([]*ent.GithubInstallation, error) {
	return self.base.DB.GithubInstallation.Query().WithGithubApp().All(ctx)
}

func (self *GithubRepository) GetInstallationsByAppID(ctx context.Context, appID int64) ([]*ent.GithubInstallation, error) {
	return self.base.DB.GithubInstallation.Query().Where(githubinstallation.GithubAppID(appID)).All(ctx)
}

// GetVisibleInstallations lists the installations of the apps the user can see.
// usableOnly drops the ones GitHub uninstalled or suspended, which cannot answer requests.
func (self *GithubRepository) GetVisibleInstallations(ctx context.Context, visibility AppVisibility, usableOnly bool) ([]*ent.GithubInstallation, error) {
	q := self.base.DB.GithubInstallation.Query().
		Where(githubinstallation.HasGithubAppWith(visibility.predicate())).
		WithGithubApp()
	if usableOnly {
		q = q.Where(githubinstallation.Active(true), githubinstallation.Suspended(false))
	}
	return q.All(ctx)
}

// GetVisibleInstallationByID answers ent.NotFoundError when the user cannot see the installation
func (self *GithubRepository) GetVisibleInstallationByID(ctx context.Context, visibility AppVisibility, ID int64) (*ent.GithubInstallation, error) {
	return self.base.DB.GithubInstallation.Query().
		Where(githubinstallation.ID(ID), githubinstallation.HasGithubAppWith(visibility.predicate())).
		WithGithubApp().
		Only(ctx)
}

// CountServicesByInstallation counts the services built from each installation, within one team when given
func (self *GithubRepository) CountServicesByInstallation(ctx context.Context, installationIDs []int64, teamID *uuid.UUID) (map[int64]int, error) {
	counts := map[int64]int{}
	if len(installationIDs) == 0 {
		return counts, nil
	}
	q := self.base.DB.Service.Query().Where(service.GithubInstallationIDIn(installationIDs...))
	if teamID != nil {
		q = q.Where(service.HasEnvironmentWith(environment.HasProjectWith(project.TeamID(*teamID))))
	}
	var rows []struct {
		InstallationID int64 `json:"github_installation_id"`
		Count          int   `json:"count"`
	}
	if err := q.GroupBy(service.FieldGithubInstallationID).Aggregate(ent.Count()).Scan(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.InstallationID] = row.Count
	}
	return counts, nil
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

func (self *GithubRepository) DeleteInstallation(ctx context.Context, id int64) error {
	return self.base.DB.GithubInstallation.DeleteOneID(id).Exec(ctx)
}
