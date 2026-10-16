package webhooks_service_test

import (
	"context"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
)

// Every decision is made on the one team or project the webhook lives on. Ids the
// caller supplies only have to name it; they never widen the check. A project that is
// not in the named team is refused before any permission is consulted.
type AccessSuite struct {
	services.ServiceTestSuite
	service     *webhooks_service.WebhooksService
	userID      uuid.UUID
	ownTeam     uuid.UUID
	ownProject  uuid.UUID
	victimTeam  uuid.UUID
	teamWebhook *ent.Webhook
}

func (suite *AccessSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = webhooks_service.NewWebhooksService(suite.MockRepo)
	suite.userID = uuid.New()
	suite.ownTeam = uuid.New()
	suite.ownProject = uuid.New()
	suite.victimTeam = uuid.New()
	suite.teamWebhook = &ent.Webhook{ID: uuid.New(), Type: schema.WebhookTypeTeam, TeamID: suite.victimTeam, URL: "https://hooks.slack.com/services/T/B/secret"}
}

func (suite *AccessSuite) allow(checks ...permissions_repo.PermissionCheck) {
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.userID, mock.Anything).RunAndReturn(func(_ context.Context, _ uuid.UUID, asked []permissions_repo.PermissionCheck) error {
		if len(asked) == 1 && slices.Contains(checks, asked[0]) {
			return nil
		}
		return errdefs.ErrUnauthorized
	})
}

func (suite *AccessSuite) TestOwnProjectDoesNotUnlockAnotherTeamsWebhook() {
	suite.allow(permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeProject, ResourceID: suite.ownProject})
	suite.MockWebhookRepo.EXPECT().GetByID(suite.Ctx, suite.teamWebhook.ID).Return(suite.teamWebhook, nil)

	_, err := suite.service.GetWebhookByID(suite.Ctx, suite.userID, &models.WebhookGetInput{ID: suite.teamWebhook.ID, TeamID: suite.victimTeam, ProjectID: suite.ownProject})
	suite.ErrorIs(err, errdefs.ErrNotFound)

	_, err = suite.service.UpdateWebhook(suite.Ctx, suite.userID, &models.WebhookUpdateInput{ID: suite.teamWebhook.ID, TeamID: suite.victimTeam, ProjectID: &suite.ownProject})
	suite.ErrorIs(err, errdefs.ErrNotFound)

	err = suite.service.DeleteWebhook(suite.Ctx, suite.userID, schema.WebhookTypeTeam, suite.teamWebhook.ID, suite.victimTeam, &suite.ownProject)
	suite.ErrorIs(err, errdefs.ErrNotFound)
	suite.MockWebhookRepo.AssertNotCalled(suite.T(), "Update", mock.Anything, mock.Anything)
	suite.MockWebhookRepo.AssertNotCalled(suite.T(), "Delete", mock.Anything, mock.Anything)
}

func (suite *AccessSuite) TestOwnTeamDoesNotUnlockAnotherTeamsProject() {
	victimProject := uuid.New()
	suite.MockProjectRepo.EXPECT().GetByID(suite.Ctx, victimProject).Return(&ent.Project{ID: victimProject, TeamID: suite.victimTeam}, nil)

	_, err := suite.service.CreateWebhook(suite.Ctx, suite.userID, &models.WebhookCreateInput{Type: schema.WebhookTypeProject, TeamID: suite.ownTeam, ProjectID: &victimProject, URL: "https://attacker.example/hook"})
	suite.ErrorIs(err, errdefs.ErrNotFound)

	_, err = suite.service.ListWebhooks(suite.Ctx, suite.userID, &models.WebhookListInput{Type: schema.WebhookTypeProject, TeamID: suite.ownTeam, ProjectID: victimProject})
	suite.ErrorIs(err, errdefs.ErrNotFound)
	suite.MockWebhookRepo.AssertNotCalled(suite.T(), "Create", mock.Anything, mock.Anything)
	suite.MockWebhookRepo.AssertNotCalled(suite.T(), "GetByProject", mock.Anything, mock.Anything)
}

func (suite *AccessSuite) TestViewerListsWithoutURLsAndEditorWithThem() {
	suite.MockWebhookRepo.EXPECT().GetByTeam(suite.Ctx, suite.victimTeam).Return([]*ent.Webhook{suite.teamWebhook}, nil)
	input := &models.WebhookListInput{Type: schema.WebhookTypeTeam, TeamID: suite.victimTeam}

	suite.allow(permissions_repo.PermissionCheck{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceID: suite.victimTeam})
	responses, err := suite.service.ListWebhooks(suite.Ctx, suite.userID, input)
	suite.NoError(err)
	suite.True(responses[0].URLRedacted)
	suite.Empty(responses[0].URL)

	suite.ServiceTestSuite.SetupTest()
	suite.service = webhooks_service.NewWebhooksService(suite.MockRepo)
	suite.MockWebhookRepo.EXPECT().GetByTeam(suite.Ctx, suite.victimTeam).Return([]*ent.Webhook{suite.teamWebhook}, nil)
	suite.allow(
		permissions_repo.PermissionCheck{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceID: suite.victimTeam},
		permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeTeam, ResourceID: suite.victimTeam},
	)
	responses, err = suite.service.ListWebhooks(suite.Ctx, suite.userID, input)
	suite.NoError(err)
	suite.False(responses[0].URLRedacted)
	suite.Equal(suite.teamWebhook.URL, responses[0].URL)
}

func TestAccessSuite(t *testing.T) {
	suite.Run(t, new(AccessSuite))
}
