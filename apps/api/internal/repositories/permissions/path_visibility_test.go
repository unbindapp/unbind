package permissions_repo

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func (suite *PermissionsPredicatesSuite) teamIDs(userID uuid.UUID, action schema.PermittedAction) []uuid.UUID {
	pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(suite.Ctx, userID, action)
	suite.Require().NoError(err)
	q := suite.DB.Team.Query()
	if pred != nil {
		q = q.Where(pred)
	}
	return q.IDsX(suite.Ctx)
}

func (suite *PermissionsPredicatesSuite) projectIDs(userID uuid.UUID, action schema.PermittedAction) []uuid.UUID {
	pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(suite.Ctx, userID, action)
	suite.Require().NoError(err)
	q := suite.DB.Project.Query()
	if pred != nil {
		q = q.Where(pred)
	}
	return q.IDsX(suite.Ctx)
}

func (suite *PermissionsPredicatesSuite) environmentIDs(userID uuid.UUID, action schema.PermittedAction) []uuid.UUID {
	pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(suite.Ctx, userID, action, nil)
	suite.Require().NoError(err)
	q := suite.DB.Environment.Query()
	if pred != nil {
		q = q.Where(pred)
	}
	return q.IDsX(suite.Ctx)
}

// A grant makes the rows above it visible for viewing, so the holder can
// navigate to what they hold, and nothing else.
func (suite *PermissionsPredicatesSuite) TestPathVisibility() {
	// A second environment in the granted project, and a second service in the
	// granted environment, must stay hidden from lower grants.
	siblingEnv := suite.DB.Environment.Create().
		SetName("Sibling Env").SetKubernetesName("sibling-env").SetKubernetesSecret("s").
		SetProjectID(suite.testProject.ID).SaveX(suite.Ctx)
	siblingService := suite.DB.Service.Create().
		SetName("Sibling Service").SetKubernetesName("sibling-service").SetType(schema.ServiceTypeDockerimage).
		SetEnvironmentID(suite.testEnv.ID).SetKubernetesSecret("s").SaveX(suite.Ctx)

	suite.Run("service grant shows its team, project and environment", func() {
		suite.ElementsMatch([]uuid.UUID{suite.testTeam.ID}, suite.teamIDs(suite.serviceEditorUser.ID, schema.ActionViewer))
		suite.ElementsMatch([]uuid.UUID{suite.testProject.ID}, suite.projectIDs(suite.serviceEditorUser.ID, schema.ActionViewer))
		suite.ElementsMatch([]uuid.UUID{suite.testEnv.ID}, suite.environmentIDs(suite.serviceEditorUser.ID, schema.ActionViewer))

		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(suite.Ctx, suite.serviceEditorUser.ID, schema.ActionViewer, nil)
		suite.Require().NoError(err)
		suite.ElementsMatch([]uuid.UUID{suite.testService.ID}, suite.DB.Service.Query().Where(pred).IDsX(suite.Ctx))
		suite.NotContains(suite.environmentIDs(suite.serviceEditorUser.ID, schema.ActionViewer), siblingEnv.ID)
		suite.NotContains(suite.DB.Service.Query().Where(pred).IDsX(suite.Ctx), siblingService.ID)
	})

	suite.Run("environment grant shows its team and project only", func() {
		suite.ElementsMatch([]uuid.UUID{suite.testTeam.ID}, suite.teamIDs(suite.envViewerUser.ID, schema.ActionViewer))
		suite.ElementsMatch([]uuid.UUID{suite.testProject.ID}, suite.projectIDs(suite.envViewerUser.ID, schema.ActionViewer))
		suite.ElementsMatch([]uuid.UUID{suite.testEnv.ID}, suite.environmentIDs(suite.envViewerUser.ID, schema.ActionViewer))
	})

	suite.Run("project grant shows its team only", func() {
		suite.ElementsMatch([]uuid.UUID{suite.testTeam.ID}, suite.teamIDs(suite.projectEditorUser.ID, schema.ActionViewer))
		suite.ElementsMatch([]uuid.UUID{suite.testProject.ID}, suite.projectIDs(suite.projectEditorUser.ID, schema.ActionViewer))
	})

	suite.Run("path never grants the action", func() {
		suite.Empty(suite.teamIDs(suite.serviceEditorUser.ID, schema.ActionEditor))
		suite.Empty(suite.projectIDs(suite.serviceEditorUser.ID, schema.ActionEditor))
		suite.Empty(suite.environmentIDs(suite.serviceEditorUser.ID, schema.ActionEditor))
		suite.Empty(suite.teamIDs(suite.projectEditorUser.ID, schema.ActionEditor))
	})

	suite.Run("all-of-type grants show the teams holding them", func() {
		suite.ElementsMatch([]uuid.UUID{suite.testTeam.ID, suite.testTeam2.ID}, suite.teamIDs(suite.projectSuperuserUser.ID, schema.ActionViewer))
		suite.ElementsMatch([]uuid.UUID{suite.testTeam.ID, suite.testTeam2.ID}, suite.teamIDs(suite.serviceSuperuserUser.ID, schema.ActionViewer))
		suite.Empty(suite.teamIDs(suite.serviceSuperuserUser.ID, schema.ActionAdmin))

		emptyTeam := suite.DB.Team.Create().
			SetName("Empty").SetKubernetesName("empty").SetNamespace("empty").SetKubernetesSecret("s").SaveX(suite.Ctx)
		suite.NotContains(suite.teamIDs(suite.serviceSuperuserUser.ID, schema.ActionViewer), emptyTeam.ID)
	})

	suite.Run("no grants sees nothing", func() {
		suite.Empty(suite.teamIDs(suite.noPermissionsUser.ID, schema.ActionViewer))
		suite.Empty(suite.projectIDs(suite.noPermissionsUser.ID, schema.ActionViewer))
	})
}

func (suite *PermissionsPredicatesSuite) TestCheckVisible() {
	visible := func(userID uuid.UUID, resourceType schema.ResourceType, id uuid.UUID) bool {
		return suite.permissionsRepo.CheckVisible(suite.Ctx, userID, resourceType, id) == nil
	}

	suite.True(visible(suite.serviceEditorUser.ID, schema.ResourceTypeTeam, suite.testTeam.ID))
	suite.True(visible(suite.serviceEditorUser.ID, schema.ResourceTypeProject, suite.testProject.ID))
	suite.True(visible(suite.serviceEditorUser.ID, schema.ResourceTypeEnvironment, suite.testEnv.ID))
	suite.True(visible(suite.serviceEditorUser.ID, schema.ResourceTypeService, suite.testService.ID))

	suite.False(visible(suite.serviceEditorUser.ID, schema.ResourceTypeTeam, suite.testTeam2.ID))
	suite.False(visible(suite.serviceEditorUser.ID, schema.ResourceTypeService, suite.testService2.ID))
	suite.False(visible(suite.noPermissionsUser.ID, schema.ResourceTypeTeam, suite.testTeam.ID))
	suite.False(visible(suite.teamViewerUser.ID, schema.ResourceTypeTeam, uuid.New()), "unknown rows are not visible")
	suite.False(visible(suite.teamViewerUser.ID, schema.ResourceTypeSystem, uuid.Nil))

	suite.True(visible(suite.teamSuperuserUser.ID, schema.ResourceTypeTeam, suite.testTeam2.ID))
	suite.NoError(suite.permissionsRepo.CheckVisible(WithSystemCaller(suite.Ctx), suite.noPermissionsUser.ID, schema.ResourceTypeTeam, suite.testTeam.ID))

	// Visibility is not authority: the hard check on the ancestor still fails.
	suite.Error(suite.permissionsRepo.Check(suite.Ctx, suite.serviceEditorUser.ID, []PermissionCheck{
		{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceID: suite.testTeam.ID},
	}))
}

// API keys narrow everything to the intersection of the owner's grants and the
// key, and path visibility applies to the key's resources the same way.
func (suite *PermissionsPredicatesSuite) TestAPIKeyNarrowsPredicates() {
	scopedToProject := WithAPIKeyAccess(suite.Ctx, APIKeyAccess{
		Role:      schema.ActionEditor,
		Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeProject, ResourceID: suite.testProject.ID}},
	})
	fullViewer := WithAPIKeyAccess(suite.Ctx, APIKeyAccess{Role: schema.ActionViewer, FullAccess: true})
	fullAdmin := WithAPIKeyAccess(suite.Ctx, APIKeyAccess{Role: schema.ActionAdmin, FullAccess: true})

	suite.Run("scoped key on a team superuser only reaches the project and its path", func() {
		ctx := scopedToProject
		pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(ctx, suite.teamSuperuserUser.ID, schema.ActionViewer)
		suite.Require().NoError(err)
		suite.ElementsMatch([]uuid.UUID{suite.testTeam.ID}, suite.DB.Team.Query().Where(pred).IDsX(suite.Ctx))

		pred, err = suite.permissionsRepo.GetAccessibleTeamPredicates(ctx, suite.teamSuperuserUser.ID, schema.ActionEditor)
		suite.Require().NoError(err)
		suite.Empty(suite.DB.Team.Query().Where(pred).IDsX(suite.Ctx), "the team itself is only on the path")

		projectPred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(ctx, suite.teamSuperuserUser.ID, schema.ActionEditor)
		suite.Require().NoError(err)
		suite.ElementsMatch([]uuid.UUID{suite.testProject.ID}, suite.DB.Project.Query().Where(projectPred).IDsX(suite.Ctx))

		servicePred, err := suite.permissionsRepo.GetAccessibleServicePredicates(ctx, suite.teamSuperuserUser.ID, schema.ActionEditor, nil)
		suite.Require().NoError(err)
		suite.ElementsMatch([]uuid.UUID{suite.testService.ID}, suite.DB.Service.Query().Where(servicePred).IDsX(suite.Ctx))

		suite.NoError(suite.permissionsRepo.CheckVisible(ctx, suite.teamSuperuserUser.ID, schema.ResourceTypeTeam, suite.testTeam.ID))
		suite.Error(suite.permissionsRepo.CheckVisible(ctx, suite.teamSuperuserUser.ID, schema.ResourceTypeTeam, suite.testTeam2.ID))
	})

	suite.Run("scoped key cannot exceed the owner", func() {
		pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(scopedToProject, suite.envViewerUser.ID, schema.ActionEditor)
		suite.Require().NoError(err)
		suite.Empty(suite.DB.Project.Query().Where(pred).IDsX(suite.Ctx))

		pred, err = suite.permissionsRepo.GetAccessibleProjectPredicates(scopedToProject, suite.envViewerUser.ID, schema.ActionViewer)
		suite.Require().NoError(err)
		suite.ElementsMatch([]uuid.UUID{suite.testProject.ID}, suite.DB.Project.Query().Where(pred).IDsX(suite.Ctx), "the owner sees the project on their own path")
	})

	suite.Run("full access key is capped at its role", func() {
		pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(fullViewer, suite.teamSuperuserUser.ID, schema.ActionViewer)
		suite.Require().NoError(err)
		suite.Nil(pred, "viewer over everything the owner holds")

		pred, err = suite.permissionsRepo.GetAccessibleTeamPredicates(fullViewer, suite.teamSuperuserUser.ID, schema.ActionAdmin)
		suite.Require().NoError(err)
		suite.Empty(suite.DB.Team.Query().Where(pred).IDsX(suite.Ctx))

		pred, err = suite.permissionsRepo.GetAccessibleTeamPredicates(fullAdmin, suite.teamViewerUser.ID, schema.ActionAdmin)
		suite.Require().NoError(err)
		suite.Empty(suite.DB.Team.Query().Where(pred).IDsX(suite.Ctx), "admin key on a viewer owner is still a viewer")

		pred, err = suite.permissionsRepo.GetAccessibleTeamPredicates(fullAdmin, suite.teamViewerUser.ID, schema.ActionViewer)
		suite.Require().NoError(err)
		suite.ElementsMatch([]uuid.UUID{suite.testTeam.ID}, suite.DB.Team.Query().Where(pred).IDsX(suite.Ctx))
	})

	suite.Run("hard checks intersect the same way", func() {
		suite.NoError(suite.permissionsRepo.Check(scopedToProject, suite.teamSuperuserUser.ID, []PermissionCheck{{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeService, ResourceID: suite.testService.ID}}))
		suite.Error(suite.permissionsRepo.Check(scopedToProject, suite.teamSuperuserUser.ID, []PermissionCheck{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeService, ResourceID: suite.testService.ID}}))
		suite.Error(suite.permissionsRepo.Check(scopedToProject, suite.teamSuperuserUser.ID, []PermissionCheck{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceID: suite.testTeam.ID}}))
		suite.Error(suite.permissionsRepo.Check(scopedToProject, suite.teamSuperuserUser.ID, []PermissionCheck{{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeService, ResourceID: suite.testService2.ID}}))
		suite.Error(suite.permissionsRepo.Check(scopedToProject, suite.envViewerUser.ID, []PermissionCheck{{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeService, ResourceID: suite.testService.ID}}), "owner is only a viewer")
		suite.NoError(suite.permissionsRepo.Check(fullAdmin, suite.superuserUser.ID, []PermissionCheck{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem}}))
		suite.Error(suite.permissionsRepo.Check(fullViewer, suite.superuserUser.ID, []PermissionCheck{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem}}))
		suite.Error(suite.permissionsRepo.Check(scopedToProject, suite.superuserUser.ID, []PermissionCheck{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeSystem}}))
	})

	suite.Run("permission set annotations follow the key", func() {
		set, err := suite.permissionsRepo.GetUserPermissionSet(scopedToProject, suite.teamSuperuserUser.ID)
		suite.Require().NoError(err)
		suite.Empty(set.TeamActions(suite.testTeam.ID))
		suite.Equal([]schema.PermittedAction{schema.ActionEditor, schema.ActionViewer}, set.ProjectActions(suite.testTeam.ID, suite.testProject.ID))
		suite.Equal([]schema.PermittedAction{schema.ActionEditor, schema.ActionViewer}, set.ServiceActions(suite.testTeam.ID, suite.testProject.ID, suite.testEnv.ID, suite.testService.ID))
		suite.Empty(set.ProjectActions(suite.testTeam2.ID, suite.testProject2.ID))

		set, err = suite.permissionsRepo.GetUserPermissionSet(fullViewer, suite.teamSuperuserUser.ID)
		suite.Require().NoError(err)
		suite.Equal([]schema.PermittedAction{schema.ActionViewer}, set.TeamActions(suite.testTeam2.ID))
	})
}
