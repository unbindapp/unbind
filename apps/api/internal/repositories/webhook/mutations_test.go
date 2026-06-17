package webhook_repo

import (
	"testing"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type WebhookMutationsSuite struct {
	repository.RepositoryBaseSuite
	webhookRepo     *WebhookRepository
	testUser        *ent.User
	testTeam        *ent.Team
	testProject     *ent.Project
	testEnvironment *ent.Environment
}

func (suite *WebhookMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.webhookRepo = NewWebhookRepository(suite.DB)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	// Create test team
	suite.testTeam = suite.DB.Team.Create().
		SetKubernetesName("test-team").
		SetName("Test Team").
		SetNamespace("test-namespace").
		SetKubernetesSecret("test-k8s-secret").
		AddMemberIDs(suite.testUser.ID).
		SaveX(suite.Ctx)

	// Create test project
	suite.testProject = suite.DB.Project.Create().
		SetKubernetesName("test-project").
		SetName("Test Project").
		SetTeamID(suite.testTeam.ID).
		SetKubernetesSecret("test-project-secret").
		SaveX(suite.Ctx)

	// Create test environment
	suite.testEnvironment = suite.DB.Environment.Create().
		SetKubernetesName("test-env").
		SetName("Test Environment").
		SetProjectID(suite.testProject.ID).
		SetKubernetesSecret("test-env-secret").
		SaveX(suite.Ctx)
}

func (suite *WebhookMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.webhookRepo = nil
	suite.testUser = nil
	suite.testTeam = nil
	suite.testProject = nil
	suite.testEnvironment = nil
}

func (suite *WebhookMutationsSuite) TestCreate() {
	suite.Run("Create Team Webhook Success", func() {
		// Clean up any existing webhooks
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		input := &models.WebhookCreateInput{
			Type:   schema.WebhookTypeTeam,
			TeamID: suite.testTeam.ID,
			URL:    "https://discord.com/api/webhooks/123456/abcdef",
			Events: []schema.WebhookEvent{
				schema.WebhookEventProjectCreated,
				schema.WebhookEventProjectDeleted,
			},
		}

		webhook, err := suite.webhookRepo.Create(suite.Ctx, input)

		suite.NoError(err)
		suite.NotNil(webhook)
		suite.Equal(schema.WebhookTypeTeam, webhook.Type)
		suite.Equal(suite.testTeam.ID, webhook.TeamID)
		suite.Nil(webhook.ProjectID)
		suite.Equal("https://discord.com/api/webhooks/123456/abcdef", webhook.URL)
		suite.Len(webhook.Events, 2)
		suite.Contains(webhook.Events, schema.WebhookEventProjectCreated)
		suite.Contains(webhook.Events, schema.WebhookEventProjectDeleted)
		suite.NotZero(webhook.ID)
		suite.NotZero(webhook.CreatedAt)
	})

	suite.Run("Create Project Webhook Success", func() {
		// Clean up any existing webhooks
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		input := &models.WebhookCreateInput{
			Type:      schema.WebhookTypeProject,
			TeamID:    suite.testTeam.ID,
			ProjectID: &suite.testProject.ID,
			URL:       "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
			Events: []schema.WebhookEvent{
				schema.WebhookEventServiceCreated,
				schema.WebhookEventDeploymentSucceeded,
				schema.WebhookEventDeploymentFailed,
			},
		}

		webhook, err := suite.webhookRepo.Create(suite.Ctx, input)

		suite.NoError(err)
		suite.NotNil(webhook)
		suite.Equal(schema.WebhookTypeProject, webhook.Type)
		suite.Equal(suite.testTeam.ID, webhook.TeamID)
		suite.NotNil(webhook.ProjectID)
		suite.Equal(suite.testProject.ID, *webhook.ProjectID)
		suite.Equal("https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX", webhook.URL)
		suite.Len(webhook.Events, 3)
		suite.Contains(webhook.Events, schema.WebhookEventServiceCreated)
		suite.Contains(webhook.Events, schema.WebhookEventDeploymentSucceeded)
		suite.Contains(webhook.Events, schema.WebhookEventDeploymentFailed)
	})

	suite.Run("Create Webhook Invalid URL", func() {
		input := &models.WebhookCreateInput{
			Type:   schema.WebhookTypeTeam,
			TeamID: suite.testTeam.ID,
			URL:    "invalid-url",
			Events: []schema.WebhookEvent{schema.WebhookEventProjectCreated},
		}

		_, err := suite.webhookRepo.Create(suite.Ctx, input)
		suite.Error(err)
		suite.ErrorContains(err, "invalid URL")
	})

	suite.Run("Create Webhook Non-existent Team", func() {
		input := &models.WebhookCreateInput{
			Type:   schema.WebhookTypeTeam,
			TeamID: uuid.New(),
			URL:    "https://example.com/webhook",
			Events: []schema.WebhookEvent{schema.WebhookEventProjectCreated},
		}

		_, err := suite.webhookRepo.Create(suite.Ctx, input)
		suite.Error(err)
		suite.ErrorContains(err, "constraint failed")
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		input := &models.WebhookCreateInput{
			Type:   schema.WebhookTypeTeam,
			TeamID: suite.testTeam.ID,
			URL:    "https://example.com/webhook",
			Events: []schema.WebhookEvent{schema.WebhookEventProjectCreated},
		}

		_, err := suite.webhookRepo.Create(suite.Ctx, input)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *WebhookMutationsSuite) TestUpdate() {
	suite.Run("Update URL Success", func() {
		// Clean up and create test webhook
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		webhook := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://old-webhook.com/endpoint").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectCreated}).
			SaveX(suite.Ctx)

		newURL := "https://new-webhook.com/endpoint"
		input := &models.WebhookUpdateInput{
			ID:     webhook.ID,
			TeamID: suite.testTeam.ID,
			URL:    &newURL,
		}

		updatedWebhook, err := suite.webhookRepo.Update(suite.Ctx, input)

		suite.NoError(err)
		suite.NotNil(updatedWebhook)
		suite.Equal(webhook.ID, updatedWebhook.ID)
		suite.Equal(newURL, updatedWebhook.URL)
		suite.Equal(webhook.Events, updatedWebhook.Events) // Events should remain unchanged
	})

	suite.Run("Update Events Success", func() {
		// Clean up and create test webhook
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		webhook := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://webhook.com/endpoint").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectCreated}).
			SaveX(suite.Ctx)

		newEvents := &[]schema.WebhookEvent{
			schema.WebhookEventProjectCreated,
			schema.WebhookEventProjectUpdated,
			schema.WebhookEventProjectDeleted,
		}
		input := &models.WebhookUpdateInput{
			ID:     webhook.ID,
			TeamID: suite.testTeam.ID,
			Events: newEvents,
		}

		updatedWebhook, err := suite.webhookRepo.Update(suite.Ctx, input)

		suite.NoError(err)
		suite.NotNil(updatedWebhook)
		suite.Equal(webhook.ID, updatedWebhook.ID)
		suite.Equal(webhook.URL, updatedWebhook.URL) // URL should remain unchanged
		suite.Len(updatedWebhook.Events, 3)
		suite.Contains(updatedWebhook.Events, schema.WebhookEventProjectCreated)
		suite.Contains(updatedWebhook.Events, schema.WebhookEventProjectUpdated)
		suite.Contains(updatedWebhook.Events, schema.WebhookEventProjectDeleted)
	})

	suite.Run("Update Both URL and Events Success", func() {
		// Clean up and create test webhook
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		webhook := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://old-webhook.com/endpoint").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectCreated}).
			SaveX(suite.Ctx)

		newURL := "https://new-webhook.com/endpoint"
		newEvents := &[]schema.WebhookEvent{
			schema.WebhookEventProjectUpdated,
			schema.WebhookEventProjectDeleted,
		}
		input := &models.WebhookUpdateInput{
			ID:     webhook.ID,
			TeamID: suite.testTeam.ID,
			URL:    &newURL,
			Events: newEvents,
		}

		updatedWebhook, err := suite.webhookRepo.Update(suite.Ctx, input)

		suite.NoError(err)
		suite.NotNil(updatedWebhook)
		suite.Equal(webhook.ID, updatedWebhook.ID)
		suite.Equal(newURL, updatedWebhook.URL)
		suite.Len(updatedWebhook.Events, 2)
		suite.Contains(updatedWebhook.Events, schema.WebhookEventProjectUpdated)
		suite.Contains(updatedWebhook.Events, schema.WebhookEventProjectDeleted)
	})

	suite.Run("Update Nothing (No Changes)", func() {
		// Clean up and create test webhook
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		webhook := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://webhook.com/endpoint").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectCreated}).
			SaveX(suite.Ctx)

		input := &models.WebhookUpdateInput{
			ID:     webhook.ID,
			TeamID: suite.testTeam.ID,
		}

		updatedWebhook, err := suite.webhookRepo.Update(suite.Ctx, input)

		suite.NoError(err)
		suite.NotNil(updatedWebhook)
		suite.Equal(webhook.ID, updatedWebhook.ID)
		suite.Equal(webhook.URL, updatedWebhook.URL)
		suite.Equal(webhook.Events, updatedWebhook.Events)
	})

	suite.Run("Update Non-existent Webhook", func() {
		newURL := "https://new-webhook.com/endpoint"
		input := &models.WebhookUpdateInput{
			ID:     uuid.New(),
			TeamID: suite.testTeam.ID,
			URL:    &newURL,
		}

		_, err := suite.webhookRepo.Update(suite.Ctx, input)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Update with Invalid URL", func() {
		// Clean up and create test webhook
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		webhook := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://webhook.com/endpoint").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectCreated}).
			SaveX(suite.Ctx)

		invalidURL := "invalid-url"
		input := &models.WebhookUpdateInput{
			ID:     webhook.ID,
			TeamID: suite.testTeam.ID,
			URL:    &invalidURL,
		}

		_, err := suite.webhookRepo.Update(suite.Ctx, input)
		suite.Error(err)
		suite.ErrorContains(err, "invalid URL")
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		newURL := "https://new-webhook.com/endpoint"
		input := &models.WebhookUpdateInput{
			ID:     uuid.New(),
			TeamID: suite.testTeam.ID,
			URL:    &newURL,
		}

		_, err := suite.webhookRepo.Update(suite.Ctx, input)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *WebhookMutationsSuite) TestDelete() {
	suite.Run("Delete Success", func() {
		// Clean up and create test webhook
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		webhook := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://webhook.com/endpoint").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectCreated}).
			SaveX(suite.Ctx)

		// Verify webhook exists
		found := suite.DB.Webhook.Query().Where(func(s *sql.Selector) {
			s.Where(sql.EQ(s.C("id"), webhook.ID))
		}).ExistX(suite.Ctx)
		suite.True(found)

		// Delete the webhook
		err := suite.webhookRepo.Delete(suite.Ctx, webhook.ID)

		suite.NoError(err)

		// Verify webhook is deleted
		exists := suite.DB.Webhook.Query().Where(func(s *sql.Selector) {
			s.Where(sql.EQ(s.C("id"), webhook.ID))
		}).ExistX(suite.Ctx)
		suite.False(exists)
	})

	suite.Run("Delete Non-existent Webhook", func() {
		// Deleting non-existent webhook should return error (ent: webhook not found)
		err := suite.webhookRepo.Delete(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		err := suite.webhookRepo.Delete(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestWebhookMutationsSuite(t *testing.T) {
	suite.Run(t, new(WebhookMutationsSuite))
}
