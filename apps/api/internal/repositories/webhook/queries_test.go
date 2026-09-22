package webhook_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	"golang.org/x/crypto/bcrypt"
)

type WebhookQueriesSuite struct {
	repository.RepositoryBaseSuite
	webhookRepo     *WebhookRepository
	testUser        *ent.User
	testTeam        *ent.Team
	testProject     *ent.Project
	testEnvironment *ent.Environment
}

func (suite *WebhookQueriesSuite) SetupTest() {
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

func (suite *WebhookQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.webhookRepo = nil
	suite.testUser = nil
	suite.testTeam = nil
	suite.testProject = nil
	suite.testEnvironment = nil
}

func (suite *WebhookQueriesSuite) TestGetByID() {
	suite.Run("Get Webhook by ID Success", func() {
		// Clean up any existing webhooks
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		// Create a test webhook
		webhook := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://discord.com/api/webhooks/123456/abcdef").
			SetEvents([]schema.WebhookEvent{
				schema.WebhookEventProjectCreated,
				schema.WebhookEventProjectDeleted,
			}).
			SaveX(suite.Ctx)

		// Get the webhook by ID
		result, err := suite.webhookRepo.GetByID(suite.Ctx, webhook.ID)

		suite.NoError(err)
		suite.NotNil(result)
		suite.Equal(webhook.ID, result.ID)
		suite.Equal(schema.WebhookTypeTeam, result.Type)
		suite.Equal(suite.testTeam.ID, result.TeamID)
		suite.Nil(result.ProjectID)
		suite.Equal("https://discord.com/api/webhooks/123456/abcdef", result.URL)
		suite.Len(result.Events, 2)
		suite.Contains(result.Events, schema.WebhookEventProjectCreated)
		suite.Contains(result.Events, schema.WebhookEventProjectDeleted)
	})

	suite.Run("Get Webhook by ID Not Found", func() {
		_, err := suite.webhookRepo.GetByID(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.webhookRepo.GetByID(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *WebhookQueriesSuite) TestGetByTeam() {
	suite.Run("Get Team Webhooks Success", func() {
		// Clean up any existing webhooks
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		// Create team webhooks
		webhook1 := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://discord.com/api/webhooks/123456/abcdef").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectCreated}).
			SaveX(suite.Ctx)

		webhook2 := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectDeleted}).
			SaveX(suite.Ctx)

		// Create a project webhook (should not be returned)
		suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetProjectID(suite.testProject.ID).
			SetType(schema.WebhookTypeProject).
			SetURL("https://example.com/project-webhook").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventServiceCreated}).
			SaveX(suite.Ctx)

		// Get team webhooks
		webhooks, err := suite.webhookRepo.GetByTeam(suite.Ctx, suite.testTeam.ID)

		suite.NoError(err)
		suite.Len(webhooks, 2)

		// Verify webhooks are ordered by created_at desc (newer first)
		suite.True(webhooks[0].CreatedAt.After(webhooks[1].CreatedAt) || webhooks[0].CreatedAt.Equal(webhooks[1].CreatedAt))

		// Find specific webhooks
		var discordWebhook, slackWebhook *ent.Webhook
		for _, wh := range webhooks {
			if wh.ID == webhook1.ID {
				discordWebhook = wh
			} else if wh.ID == webhook2.ID {
				slackWebhook = wh
			}
		}

		suite.NotNil(discordWebhook)
		suite.NotNil(slackWebhook)

		// Verify all are team type
		for _, wh := range webhooks {
			suite.Equal(schema.WebhookTypeTeam, wh.Type)
			suite.Equal(suite.testTeam.ID, wh.TeamID)
			suite.Nil(wh.ProjectID)
		}
	})

	suite.Run("Get Team Webhooks Empty Result", func() {
		// Clean up any existing webhooks
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		// Get webhooks for team with no webhooks
		webhooks, err := suite.webhookRepo.GetByTeam(suite.Ctx, suite.testTeam.ID)

		suite.NoError(err)
		suite.Len(webhooks, 0)
	})

	suite.Run("Get Team Webhooks Non-existent Team", func() {
		// Get webhooks for non-existent team
		webhooks, err := suite.webhookRepo.GetByTeam(suite.Ctx, uuid.New())

		suite.NoError(err)
		suite.Len(webhooks, 0)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.webhookRepo.GetByTeam(suite.Ctx, suite.testTeam.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *WebhookQueriesSuite) TestGetByProject() {
	suite.Run("Get Project Webhooks Success", func() {
		// Clean up any existing webhooks
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		// Create project webhooks
		webhook1 := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetProjectID(suite.testProject.ID).
			SetType(schema.WebhookTypeProject).
			SetURL("https://discord.com/api/webhooks/123456/abcdef").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventServiceCreated}).
			SaveX(suite.Ctx)

		webhook2 := suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetProjectID(suite.testProject.ID).
			SetType(schema.WebhookTypeProject).
			SetURL("https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventDeploymentFailed}).
			SaveX(suite.Ctx)

		// Create a team webhook (should not be returned)
		suite.DB.Webhook.Create().
			SetTeamID(suite.testTeam.ID).
			SetType(schema.WebhookTypeTeam).
			SetURL("https://example.com/team-webhook").
			SetEvents([]schema.WebhookEvent{schema.WebhookEventProjectCreated}).
			SaveX(suite.Ctx)

		// Get project webhooks
		webhooks, err := suite.webhookRepo.GetByProject(suite.Ctx, suite.testProject.ID)

		suite.NoError(err)
		suite.Len(webhooks, 2)

		// Verify webhooks are ordered by created_at desc (newer first)
		suite.True(webhooks[0].CreatedAt.After(webhooks[1].CreatedAt) || webhooks[0].CreatedAt.Equal(webhooks[1].CreatedAt))

		// Find specific webhooks
		var discordWebhook, slackWebhook *ent.Webhook
		for _, wh := range webhooks {
			if wh.ID == webhook1.ID {
				discordWebhook = wh
			} else if wh.ID == webhook2.ID {
				slackWebhook = wh
			}
		}

		suite.NotNil(discordWebhook)
		suite.NotNil(slackWebhook)

		// Verify all are project type
		for _, wh := range webhooks {
			suite.Equal(schema.WebhookTypeProject, wh.Type)
			suite.Equal(suite.testTeam.ID, wh.TeamID)
			suite.NotNil(wh.ProjectID)
			suite.Equal(suite.testProject.ID, *wh.ProjectID)
		}
	})

	suite.Run("Get Project Webhooks Empty Result", func() {
		// Clean up any existing webhooks
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		// Get webhooks for project with no webhooks
		webhooks, err := suite.webhookRepo.GetByProject(suite.Ctx, suite.testProject.ID)

		suite.NoError(err)
		suite.Len(webhooks, 0)
	})

	suite.Run("Get Project Webhooks Non-existent Project", func() {
		// Get webhooks for non-existent project
		webhooks, err := suite.webhookRepo.GetByProject(suite.Ctx, uuid.New())

		suite.NoError(err)
		suite.Len(webhooks, 0)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.webhookRepo.GetByProject(suite.Ctx, suite.testProject.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *WebhookQueriesSuite) createTeam(name string) *ent.Team {
	return suite.DB.Team.Create().
		SetKubernetesName(name).
		SetName(name).
		SetNamespace(name).
		SetKubernetesSecret(name + "-secret").
		AddMemberIDs(suite.testUser.ID).
		SaveX(suite.Ctx)
}

func (suite *WebhookQueriesSuite) createProject(teamID uuid.UUID, name string) *ent.Project {
	return suite.DB.Project.Create().
		SetKubernetesName(name).
		SetName(name).
		SetTeamID(teamID).
		SetKubernetesSecret(name + "-secret").
		SaveX(suite.Ctx)
}

func (suite *WebhookQueriesSuite) createWebhook(teamID uuid.UUID, projectID *uuid.UUID, url string, events ...schema.WebhookEvent) *ent.Webhook {
	create := suite.DB.Webhook.Create().
		SetTeamID(teamID).
		SetType(schema.WebhookTypeTeam).
		SetURL(url).
		SetEvents(events)
	if projectID != nil {
		create.SetProjectID(*projectID).SetType(schema.WebhookTypeProject)
	}
	return create.SaveX(suite.Ctx)
}

func webhookIDs(webhooks []*ent.Webhook) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(webhooks))
	for _, wh := range webhooks {
		ids = append(ids, wh.ID)
	}
	return ids
}

func (suite *WebhookQueriesSuite) TestGetByTeamForEvent() {
	suite.Run("Returns every team webhook subscribed to the event", func() {
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		webhook1 := suite.createWebhook(suite.testTeam.ID, nil, "https://example.com/1", schema.WebhookEventProjectCreated, schema.WebhookEventProjectDeleted)
		webhook2 := suite.createWebhook(suite.testTeam.ID, nil, "https://example.com/2", schema.WebhookEventProjectCreated)
		suite.createWebhook(suite.testTeam.ID, nil, "https://example.com/3", schema.WebhookEventProjectUpdated)

		webhooks, err := suite.webhookRepo.GetByTeamForEvent(suite.Ctx, suite.testTeam.ID, schema.WebhookEventProjectCreated)

		suite.NoError(err)
		suite.ElementsMatch([]uuid.UUID{webhook1.ID, webhook2.ID}, webhookIDs(webhooks))
	})

	suite.Run("Ignores webhooks of other teams", func() {
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		otherTeam := suite.createTeam("team-b")
		suite.createWebhook(otherTeam.ID, nil, "https://example.com/other", schema.WebhookEventProjectCreated)
		mine := suite.createWebhook(suite.testTeam.ID, nil, "https://example.com/mine", schema.WebhookEventProjectCreated)

		webhooks, err := suite.webhookRepo.GetByTeamForEvent(suite.Ctx, suite.testTeam.ID, schema.WebhookEventProjectCreated)

		suite.NoError(err)
		suite.Equal([]uuid.UUID{mine.ID}, webhookIDs(webhooks))
	})

	suite.Run("Ignores project webhooks of the same team", func() {
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		suite.createWebhook(suite.testTeam.ID, &suite.testProject.ID, "https://example.com/project", schema.WebhookEventProjectCreated)

		webhooks, err := suite.webhookRepo.GetByTeamForEvent(suite.Ctx, suite.testTeam.ID, schema.WebhookEventProjectCreated)

		suite.NoError(err)
		suite.Len(webhooks, 0)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.webhookRepo.GetByTeamForEvent(suite.Ctx, suite.testTeam.ID, schema.WebhookEventProjectCreated)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *WebhookQueriesSuite) TestGetByProjectForEvent() {
	suite.Run("Returns every project webhook subscribed to the event", func() {
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		webhook1 := suite.createWebhook(suite.testTeam.ID, &suite.testProject.ID, "https://example.com/1", schema.WebhookEventDeploymentFailed, schema.WebhookEventServiceCreated)
		webhook2 := suite.createWebhook(suite.testTeam.ID, &suite.testProject.ID, "https://example.com/2", schema.WebhookEventDeploymentFailed)
		suite.createWebhook(suite.testTeam.ID, &suite.testProject.ID, "https://example.com/3", schema.WebhookEventDeploymentSucceeded)

		webhooks, err := suite.webhookRepo.GetByProjectForEvent(suite.Ctx, suite.testProject.ID, schema.WebhookEventDeploymentFailed)

		suite.NoError(err)
		suite.ElementsMatch([]uuid.UUID{webhook1.ID, webhook2.ID}, webhookIDs(webhooks))
	})

	suite.Run("Ignores webhooks of other projects in the same team", func() {
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		otherProject := suite.createProject(suite.testTeam.ID, "project-b")
		suite.createWebhook(suite.testTeam.ID, &otherProject.ID, "https://example.com/other", schema.WebhookEventDeploymentFailed)
		mine := suite.createWebhook(suite.testTeam.ID, &suite.testProject.ID, "https://example.com/mine", schema.WebhookEventDeploymentFailed)

		webhooks, err := suite.webhookRepo.GetByProjectForEvent(suite.Ctx, suite.testProject.ID, schema.WebhookEventDeploymentFailed)

		suite.NoError(err)
		suite.Equal([]uuid.UUID{mine.ID}, webhookIDs(webhooks))
	})

	suite.Run("Ignores webhooks of other teams", func() {
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		otherTeam := suite.createTeam("team-c")
		otherProject := suite.createProject(otherTeam.ID, "project-c")
		suite.createWebhook(otherTeam.ID, &otherProject.ID, "https://example.com/other", schema.WebhookEventDeploymentFailed)

		webhooks, err := suite.webhookRepo.GetByProjectForEvent(suite.Ctx, suite.testProject.ID, schema.WebhookEventDeploymentFailed)

		suite.NoError(err)
		suite.Len(webhooks, 0)
	})

	suite.Run("Ignores team webhooks", func() {
		suite.DB.Webhook.Delete().ExecX(suite.Ctx)

		suite.createWebhook(suite.testTeam.ID, nil, "https://example.com/team", schema.WebhookEventDeploymentFailed)

		webhooks, err := suite.webhookRepo.GetByProjectForEvent(suite.Ctx, suite.testProject.ID, schema.WebhookEventDeploymentFailed)

		suite.NoError(err)
		suite.Len(webhooks, 0)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.webhookRepo.GetByProjectForEvent(suite.Ctx, suite.testProject.ID, schema.WebhookEventDeploymentFailed)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestWebhookQueriesSuite(t *testing.T) {
	suite.Run(t, new(WebhookQueriesSuite))
}
