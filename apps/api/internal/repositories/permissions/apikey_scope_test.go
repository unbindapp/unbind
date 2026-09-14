package permissions_repo

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

func TestScopesAllow(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()
	otherProjectID := uuid.New()
	projectHierarchy := []ResourceHierarchyInfo{{ResourceType: schema.ResourceTypeTeam, ResourceID: teamID}}

	tests := map[string]struct {
		scopes       []schema.APIKeyScope
		action       schema.PermittedAction
		resourceType schema.ResourceType
		resourceID   uuid.UUID
		hierarchy    []ResourceHierarchyInfo
		want         bool
	}{
		"direct id match": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: projectID}}},
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeProject,
			resourceID:   projectID,
			want:         true,
		},
		"different id denied": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: projectID}}},
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeProject,
			resourceID:   otherProjectID,
			want:         false,
		},
		"stronger scope action implies weaker check": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: projectID}}},
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeProject,
			resourceID:   projectID,
			want:         true,
		},
		"weaker scope action denies stronger check": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: projectID}}},
			action:       schema.ActionEditor,
			resourceType: schema.ResourceTypeProject,
			resourceID:   projectID,
			want:         false,
		},
		"superuser on type matches any id": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{Superuser: true}}},
			action:       schema.ActionEditor,
			resourceType: schema.ResourceTypeProject,
			resourceID:   otherProjectID,
			want:         true,
		},
		"superuser on type matches nil id": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeSystem, ResourceSelector: schema.ResourceSelector{Superuser: true}}},
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeSystem,
			want:         true,
		},
		"id scope never matches nil id": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{ID: teamID}}},
			action:       schema.ActionAdmin,
			resourceType: schema.ResourceTypeTeam,
			want:         false,
		},
		"parent id in hierarchy grants child": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{ID: teamID}}},
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeProject,
			resourceID:   projectID,
			hierarchy:    projectHierarchy,
			want:         true,
		},
		"parent superuser in hierarchy grants child": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{Superuser: true}}},
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeProject,
			resourceID:   projectID,
			hierarchy:    projectHierarchy,
			want:         true,
		},
		"child scope does not grant parent": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: projectID}}},
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeTeam,
			resourceID:   teamID,
			want:         false,
		},
		"wrong type superuser denied": {
			scopes:       []schema.APIKeyScope{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem, ResourceSelector: schema.ResourceSelector{Superuser: true}}},
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeTeam,
			resourceID:   teamID,
			want:         false,
		},
		"no scopes denies": {
			scopes:       nil,
			action:       schema.ActionViewer,
			resourceType: schema.ResourceTypeProject,
			resourceID:   projectID,
			want:         false,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			if got := scopesAllow(tc.scopes, tc.action, tc.resourceType, tc.resourceID, tc.hierarchy); got != tc.want {
				t.Fatalf("scopesAllow = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestScopesAllowWrites(t *testing.T) {
	view := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{Superuser: true}}
	edit := schema.APIKeyScope{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: uuid.New()}}
	admin := schema.APIKeyScope{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem, ResourceSelector: schema.ResourceSelector{Superuser: true}}

	tests := map[string]struct {
		scopes []schema.APIKeyScope
		want   bool
	}{
		"none":      {nil, false},
		"view only": {[]schema.APIKeyScope{view, view}, false},
		"has edit":  {[]schema.APIKeyScope{view, edit}, true},
		"has admin": {[]schema.APIKeyScope{admin}, true},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			if got := ScopesAllowWrites(tc.scopes); got != tc.want {
				t.Fatalf("ScopesAllowWrites = %v, want %v", got, tc.want)
			}
		})
	}
}

func scoped(ctx context.Context, scopes ...schema.APIKeyScope) context.Context {
	return WithAPIKeyScopes(ctx, scopes)
}

// testUser holds team view on testTeam and project edit on testProject.
func (suite *PermissionsCheckerSuite) TestCheckIntersectsAPIKeyScopes() {
	projectView := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: suite.testProject.ID}}
	ctx := scoped(suite.Ctx, projectView)

	check := func(ctx context.Context, action schema.PermittedAction, resourceType schema.ResourceType, id uuid.UUID) error {
		return suite.permissionsRepo.Check(ctx, suite.testUser.ID, []PermissionCheck{{Action: action, ResourceType: resourceType, ResourceID: id}})
	}

	suite.NoError(check(suite.Ctx, schema.ActionEditor, schema.ResourceTypeProject, suite.testProject.ID), "session keeps the user's full grant")
	suite.NoError(check(ctx, schema.ActionViewer, schema.ResourceTypeProject, suite.testProject.ID), "scope within grant passes")
	suite.NoError(check(ctx, schema.ActionViewer, schema.ResourceTypeService, suite.testService.ID), "scope on the project reaches its services")
	suite.ErrorIs(check(ctx, schema.ActionEditor, schema.ResourceTypeProject, suite.testProject.ID), errdefs.ErrUnauthorized, "key cannot use the edit the user holds but did not scope")
	suite.ErrorIs(check(ctx, schema.ActionViewer, schema.ResourceTypeTeam, suite.testTeam.ID), errdefs.ErrUnauthorized, "key cannot use the team view the user holds but did not scope")
	suite.ErrorIs(check(scoped(suite.Ctx), schema.ActionViewer, schema.ResourceTypeProject, suite.testProject.ID), errdefs.ErrUnauthorized, "empty scopes deny everything")
	suite.NoError(suite.permissionsRepo.Check(ctx, suite.testUser.ID, nil), "no checks still means nothing to deny")
}

func (suite *PermissionsCheckerSuite) TestCheckScopeCannotExceedUser() {
	everything := schema.APIKeyScope{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{Superuser: true}}
	ctx := scoped(suite.Ctx, everything)

	check := func(action schema.PermittedAction, id uuid.UUID) error {
		return suite.permissionsRepo.Check(ctx, suite.testUser.ID, []PermissionCheck{{Action: action, ResourceType: schema.ResourceTypeTeam, ResourceID: id}})
	}

	suite.NoError(check(schema.ActionViewer, suite.testTeam.ID))
	suite.ErrorIs(check(schema.ActionAdmin, suite.testTeam.ID), errdefs.ErrUnauthorized, "user only views this team")
	suite.ErrorIs(check(schema.ActionViewer, suite.testTeam2.ID), errdefs.ErrUnauthorized, "user has nothing on the other team")

	suite.DB.User.UpdateOneID(suite.testUser.ID).ClearGroups().ExecX(suite.Ctx)
	suite.ErrorIs(check(schema.ActionViewer, suite.testTeam.ID), errdefs.ErrUnauthorized, "key dies with the user's grants")
}

func (suite *PermissionsCheckerSuite) TestScopedPredicatesNarrowListing() {
	suite.DB.User.UpdateOneID(suite.testUser.ID).AddGroupIDs(suite.teamAdminGroup.ID).ExecX(suite.Ctx)
	teamViewBoth := suite.DB.Permission.Create().
		SetAction(schema.ActionViewer).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(suite.teamAdminGroup.ID).AddPermissionIDs(teamViewBoth.ID).ExecX(suite.Ctx)

	sessionPred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(suite.Ctx, suite.testUser.ID, schema.ActionViewer)
	suite.NoError(err)
	suite.Nil(sessionPred, "team superuser sees every project in a session")

	projectScope := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: suite.testProject.ID}}
	scopedPred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(scoped(suite.Ctx, projectScope), suite.testUser.ID, schema.ActionViewer)
	suite.NoError(err)
	projects := suite.DB.Project.Query().Where(scopedPred).AllX(suite.Ctx)
	suite.Len(projects, 1)
	suite.Equal(suite.testProject.ID, projects[0].ID)

	servicePred, err := suite.permissionsRepo.GetAccessibleServicePredicates(scoped(suite.Ctx, projectScope), suite.testUser.ID, schema.ActionViewer, nil)
	suite.NoError(err)
	services := suite.DB.Service.Query().Where(servicePred).AllX(suite.Ctx)
	suite.Len(services, 1)
	suite.Equal(suite.testService.ID, services[0].ID, "project scope reaches services through the hierarchy")

	teamScope := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{ID: suite.testTeam2.ID}}
	envPred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(scoped(suite.Ctx, teamScope), suite.testUser.ID, schema.ActionViewer, nil)
	suite.NoError(err)
	envs := suite.DB.Environment.Query().Where(envPred).AllX(suite.Ctx)
	suite.Len(envs, 1)
	suite.Equal(suite.testEnv2.ID, envs[0].ID)

	editOnly := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: suite.testProject.ID}}
	editPred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(scoped(suite.Ctx, editOnly), suite.testUser.ID, schema.ActionEditor)
	suite.NoError(err)
	suite.Empty(suite.DB.Project.Query().Where(editPred).AllX(suite.Ctx), "a view scope lists nothing when edit is required")

	scopedTeams, err := suite.permissionsRepo.GetAccessibleTeamPredicates(scoped(suite.Ctx, projectScope), suite.testUser.ID, schema.ActionViewer)
	suite.NoError(err)
	suite.Empty(suite.DB.Team.Query().Where(scopedTeams).AllX(suite.Ctx), "a project scope lists no teams")
}

// Regression: a service-only scope must still list that service even though it
// grants nothing at the environment level the service builder nests on.
func (suite *PermissionsCheckerSuite) TestServiceScopeListsServiceWithinEnvironment() {
	suite.DB.User.UpdateOneID(suite.testUser.ID).AddGroupIDs(suite.teamAdminGroup.ID).ExecX(suite.Ctx)
	serviceScope := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeService, ResourceSelector: schema.ResourceSelector{ID: suite.testService.ID}}

	pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(scoped(suite.Ctx, serviceScope), suite.testUser.ID, schema.ActionViewer, &suite.testEnv.ID)
	suite.NoError(err)
	services := suite.DB.Service.Query().Where(pred).AllX(suite.Ctx)
	suite.Len(services, 1)
	suite.Equal(suite.testService.ID, services[0].ID)

	envScope := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeEnvironment, ResourceSelector: schema.ResourceSelector{ID: suite.testEnv.ID}}
	envPred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(scoped(suite.Ctx, envScope), suite.testUser.ID, schema.ActionViewer, &suite.testProject.ID)
	suite.NoError(err)
	envs := suite.DB.Environment.Query().Where(envPred).AllX(suite.Ctx)
	suite.Len(envs, 1)
	suite.Equal(suite.testEnv.ID, envs[0].ID)

	otherEnvPred, err := suite.permissionsRepo.GetAccessibleServicePredicates(scoped(suite.Ctx, serviceScope), suite.testUser.ID, schema.ActionViewer, &suite.testEnv2.ID)
	suite.NoError(err)
	suite.Empty(suite.DB.Service.Query().Where(otherEnvPred).AllX(suite.Ctx), "the scoped service is not in the other environment")
}

func (suite *PermissionsCheckerSuite) TestScopedPredicatesStayWithinUser() {
	teamScope := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{Superuser: true}}
	pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(scoped(suite.Ctx, teamScope), suite.testUser.ID, schema.ActionViewer)
	suite.NoError(err)
	projects := suite.DB.Project.Query().Where(pred).AllX(suite.Ctx)
	suite.Len(projects, 1)
	suite.Equal(suite.testProject.ID, projects[0].ID, "a broad scope still only lists what the user can see")
}

func (suite *PermissionsCheckerSuite) TestPermissionSetLimitedByScopes() {
	projectView := schema.APIKeyScope{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: suite.testProject.ID}}

	session, err := suite.permissionsRepo.GetUserPermissionSet(suite.Ctx, suite.testUser.ID)
	suite.NoError(err)
	suite.Equal([]schema.PermittedAction{schema.ActionEditor, schema.ActionViewer}, session.ProjectActions(suite.testTeam.ID, suite.testProject.ID))

	set, err := suite.permissionsRepo.GetUserPermissionSet(scoped(suite.Ctx, projectView), suite.testUser.ID)
	suite.NoError(err)
	suite.Equal([]schema.PermittedAction{schema.ActionViewer}, set.ProjectActions(suite.testTeam.ID, suite.testProject.ID))
	suite.Equal([]schema.PermittedAction{schema.ActionViewer}, set.ServiceActions(suite.testTeam.ID, suite.testProject.ID, suite.testEnv.ID, suite.testService.ID))
	suite.Empty(set.TeamActions(suite.testTeam.ID))

	broader := schema.APIKeyScope{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: suite.testProject.ID}}
	set, err = suite.permissionsRepo.GetUserPermissionSet(scoped(suite.Ctx, broader), suite.testUser.ID)
	suite.NoError(err)
	suite.Equal([]schema.PermittedAction{schema.ActionEditor, schema.ActionViewer}, set.ProjectActions(suite.testTeam.ID, suite.testProject.ID), "scope cannot raise the user's own level")
}
