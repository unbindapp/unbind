package github_repo

import (
	"context"

	"github.com/google/go-github/v69/github"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubapp"
	"github.com/unbindapp/unbind-api/ent/predicate"
)

// AppVisibility is who is asking: a user sees the apps they created and the
// ones shared with a team they can view. A nil Teams means every team.
type AppVisibility struct {
	UserID uuid.UUID
	Teams  predicate.Team
}

func (self AppVisibility) predicate() predicate.GithubApp {
	shared := githubapp.HasTeam()
	if self.Teams != nil {
		shared = githubapp.HasTeamWith(self.Teams)
	}
	return githubapp.Or(githubapp.CreatedBy(self.UserID), shared)
}

// AppFilter narrows a visible app listing further
type AppFilter struct {
	// OwnedOnly keeps the apps the user created
	OwnedOnly bool
	// TeamID keeps the apps shared with one team
	TeamID *uuid.UUID
}

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

func (self *GithubRepository) GetVisibleApps(ctx context.Context, visibility AppVisibility, filter AppFilter) ([]*ent.GithubApp, error) {
	q := self.base.DB.GithubApp.Query().
		Where(visibility.predicate()).
		WithInstallations().
		WithTeam().
		WithUsers().
		Order(ent.Asc(githubapp.FieldCreatedAt))
	if filter.OwnedOnly {
		q = q.Where(githubapp.CreatedBy(visibility.UserID))
	}
	if filter.TeamID != nil {
		q = q.Where(githubapp.TeamID(*filter.TeamID))
	}
	return q.All(ctx)
}

func (self *GithubRepository) GetVisibleAppByUUID(ctx context.Context, visibility AppVisibility, ID uuid.UUID) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.Query().
		Where(githubapp.UUID(ID), visibility.predicate()).
		WithInstallations().
		WithTeam().
		WithUsers().
		Only(ctx)
}

func (self *GithubRepository) CreateApp(ctx context.Context, uniqueUuid uuid.UUID, app *github.AppConfig, createdBy uuid.UUID, teamID *uuid.UUID) (*ent.GithubApp, error) {
	create := self.base.DB.GithubApp.Create().
		SetID(app.GetID()).
		SetUUID(uniqueUuid).
		SetClientID(app.GetClientID()).
		SetClientSecret(app.GetClientSecret()).
		SetWebhookSecret(app.GetWebhookSecret()).
		SetPrivateKey(app.GetPEM()).
		SetName(app.GetName()).
		SetCreatedBy(createdBy).
		SetNillableTeamID(teamID)
	if owner := app.GetOwner(); owner != nil {
		create = create.SetOwnerLogin(owner.GetLogin())
		if ownerType := githubapp.OwnerType(owner.GetType()); githubapp.OwnerTypeValidator(ownerType) == nil {
			create = create.SetOwnerType(ownerType)
		}
	}
	return create.Save(ctx)
}

func (self *GithubRepository) GetGithubAppByID(ctx context.Context, ID int64) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.Query().Where(githubapp.ID(ID)).Only(ctx)
}

func (self *GithubRepository) GetGithubAppByUUID(ctx context.Context, ID uuid.UUID) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.Query().Where(githubapp.UUID(ID)).WithInstallations().WithTeam().WithUsers().Only(ctx)
}

func (self *GithubRepository) SetAppTeam(ctx context.Context, ID int64, teamID *uuid.UUID) (*ent.GithubApp, error) {
	update := self.base.DB.GithubApp.UpdateOneID(ID)
	if teamID == nil {
		update = update.ClearTeamID()
	} else {
		update = update.SetTeamID(*teamID)
	}
	return update.Save(ctx)
}

func (self *GithubRepository) SetAppOwner(ctx context.Context, ID int64, login string, ownerType githubapp.OwnerType) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.UpdateOneID(ID).
		SetOwnerLogin(login).
		SetOwnerType(ownerType).
		Save(ctx)
}

func (self *GithubRepository) DeleteApp(ctx context.Context, ID int64) error {
	return self.base.DB.GithubApp.DeleteOneID(ID).Exec(ctx)
}

// DeletePrivateAppsByCreator removes the apps only their creator could use
func (self *GithubRepository) DeletePrivateAppsByCreator(ctx context.Context, createdBy uuid.UUID) (int, error) {
	return self.base.DB.GithubApp.Delete().
		Where(githubapp.CreatedBy(createdBy), githubapp.TeamIDIsNil()).
		Exec(ctx)
}
