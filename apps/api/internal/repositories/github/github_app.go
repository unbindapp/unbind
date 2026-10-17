package github_repo

import (
	"context"

	"entgo.io/ent/dialect/sql"
	"github.com/google/go-github/v69/github"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubapp"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/team"
)

// AppVisibility is who is asking: a user sees the apps they created, the ones shared
// with a team they can view, and the ones shared with all teams once they can view any.
// A nil Teams means every team.
type AppVisibility struct {
	UserID uuid.UUID
	Teams  predicate.Team
}

// TeamAppVisibility is what the user can build from in one team: their own apps,
// the ones shared with the team and the ones shared with all teams
func TeamAppVisibility(userID uuid.UUID, teamID uuid.UUID) AppVisibility {
	return AppVisibility{UserID: userID, Teams: team.ID(teamID)}
}

func (self AppVisibility) predicate() predicate.GithubApp {
	if self.Teams == nil {
		return githubapp.Or(githubapp.CreatedBy(self.UserID), githubapp.HasTeams(), githubapp.SharedWithAllTeams(true))
	}
	return githubapp.Or(
		githubapp.CreatedBy(self.UserID),
		githubapp.HasTeamsWith(self.Teams),
		githubapp.And(githubapp.SharedWithAllTeams(true), anyTeam(self.Teams)),
	)
}

// anyTeam matches when at least one team passes the predicate
func anyTeam(teams predicate.Team) predicate.GithubApp {
	return func(s *sql.Selector) {
		t := sql.Table(team.Table)
		sub := sql.Select(t.C(team.FieldID)).From(t)
		teams(sub)
		s.Where(sql.Exists(sub))
	}
}

// withTeams loads the teams an app is shared with that the user can view or
// shared one of their own apps with, so other teams' names stay hidden
func (self AppVisibility) withTeams(q *ent.TeamQuery) {
	q.Order(ent.Asc(team.FieldName))
	if self.Teams == nil {
		return
	}
	q.Where(team.Or(self.Teams, team.HasGithubAppsWith(githubapp.CreatedBy(self.UserID))))
}

// AppFilter narrows a visible app listing further
type AppFilter struct {
	// OwnedOnly keeps the apps the user created
	OwnedOnly bool
	// TeamID keeps the apps shared with this team
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
		WithTeams(visibility.withTeams).
		WithUsers().
		Order(ent.Asc(githubapp.FieldCreatedAt))
	if filter.OwnedOnly {
		q = q.Where(githubapp.CreatedBy(visibility.UserID))
	}
	if filter.TeamID != nil {
		q = q.Where(githubapp.Or(githubapp.HasTeamsWith(team.ID(*filter.TeamID)), githubapp.SharedWithAllTeams(true)))
	}
	return q.All(ctx)
}

func (self *GithubRepository) GetVisibleAppByUUID(ctx context.Context, visibility AppVisibility, ID uuid.UUID) (*ent.GithubApp, error) {
	return self.base.DB.GithubApp.Query().
		Where(githubapp.UUID(ID), visibility.predicate()).
		WithInstallations().
		WithTeams(visibility.withTeams).
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
		SetSlug(app.GetSlug()).
		SetCreatedBy(createdBy)
	if teamID != nil {
		create = create.AddTeamIDs(*teamID)
	}
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
	return self.base.DB.GithubApp.Query().Where(githubapp.UUID(ID)).WithInstallations().WithTeams().WithUsers().Only(ctx)
}

// GetAppTeamIDs lists every team the app is shared with, including the ones the caller cannot view
func (self *GithubRepository) GetAppTeamIDs(ctx context.Context, ID int64) ([]uuid.UUID, error) {
	return self.base.DB.GithubApp.Query().Where(githubapp.ID(ID)).QueryTeams().IDs(ctx)
}

func (self *GithubRepository) UpdateAppTeams(ctx context.Context, ID int64, add []uuid.UUID, remove []uuid.UUID, allTeams bool) error {
	return self.base.DB.GithubApp.UpdateOneID(ID).
		AddTeamIDs(add...).
		RemoveTeamIDs(remove...).
		SetSharedWithAllTeams(allTeams).
		Exec(ctx)
}

// UpdateAppFromGithub stores the name, slug and owner the app has on GitHub now
func (self *GithubRepository) UpdateAppFromGithub(ctx context.Context, ID int64, app *github.App) (*ent.GithubApp, error) {
	update := self.base.DB.GithubApp.UpdateOneID(ID)
	if app.GetName() != "" {
		update = update.SetName(app.GetName())
	}
	if app.GetSlug() != "" {
		update = update.SetSlug(app.GetSlug())
	}
	if owner := app.GetOwner(); owner.GetLogin() != "" {
		update = update.SetOwnerLogin(owner.GetLogin())
		if ownerType := githubapp.OwnerType(owner.GetType()); githubapp.OwnerTypeValidator(ownerType) == nil {
			update = update.SetOwnerType(ownerType)
		}
	}
	return update.Save(ctx)
}

func (self *GithubRepository) DeleteApp(ctx context.Context, ID int64) error {
	return self.base.DB.GithubApp.DeleteOneID(ID).Exec(ctx)
}

// DeletePrivateAppsByCreator removes the apps only their creator could use
func (self *GithubRepository) DeletePrivateAppsByCreator(ctx context.Context, createdBy uuid.UUID) (int, error) {
	return self.base.DB.GithubApp.Delete().
		Where(githubapp.CreatedBy(createdBy), githubapp.Not(githubapp.HasTeams()), githubapp.SharedWithAllTeams(false)).
		Exec(ctx)
}
