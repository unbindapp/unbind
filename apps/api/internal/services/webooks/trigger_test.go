package webhooks_service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_permissions "github.com/unbindapp/unbind-api/mocks/repository/permissions"
	mocks_repository_webhook "github.com/unbindapp/unbind-api/mocks/repository/webhook"
)

type hitCounter struct {
	mu   sync.Mutex
	hits map[string]int
}

func newReceiver(t *testing.T, failing map[string]bool) (*httptest.Server, *hitCounter) {
	counter := &hitCounter{hits: map[string]int{}}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		counter.mu.Lock()
		counter.hits[r.URL.Path]++
		counter.mu.Unlock()
		if failing[r.URL.Path] {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)
	return server, counter
}

func newTriggerService(t *testing.T, client *http.Client) (*WebhooksService, *mocks_repository_webhook.WebhookRepositoryMock) {
	repo := mocks_repositories.NewRepositoriesMock(t)
	webhookRepo := mocks_repository_webhook.NewWebhookRepositoryMock(t)
	repo.EXPECT().Webhooks().Return(webhookRepo)
	return &WebhooksService{repo: repo, httpClient: client}, webhookRepo
}

func TestTriggerWebhooks_SendsToEveryWebhook(t *testing.T) {
	server, counter := newReceiver(t, nil)
	service, webhookRepo := newTriggerService(t, server.Client())
	projectID := uuid.New()

	webhookRepo.EXPECT().GetByProjectForEvent(mock.Anything, projectID, schema.WebhookEventDeploymentFailed).Return([]*ent.Webhook{
		{URL: server.URL + "/first"},
		{URL: server.URL + "/second"},
	}, nil)

	err := service.TriggerWebhooks(context.Background(), WebhookLevelDeploymentFailed, schema.WebhookEventDeploymentFailed, WebhookData{Title: "Deployment Failed"}, uuid.New(), projectID)

	require.NoError(t, err)
	assert.Equal(t, map[string]int{"/first": 1, "/second": 1}, counter.hits)
}

func TestTriggerWebhooks_FailingWebhookDoesNotStopTheNext(t *testing.T) {
	server, counter := newReceiver(t, map[string]bool{"/broken": true})
	service, webhookRepo := newTriggerService(t, server.Client())
	projectID := uuid.New()

	webhookRepo.EXPECT().GetByProjectForEvent(mock.Anything, projectID, schema.WebhookEventServiceUpdated).Return([]*ent.Webhook{
		{URL: server.URL + "/broken"},
		{URL: "http://127.0.0.1:1/unreachable"},
		{URL: server.URL + "/working"},
	}, nil)

	err := service.TriggerWebhooks(context.Background(), WebhookLevelInfo, schema.WebhookEventServiceUpdated, WebhookData{Title: "Service Updated"}, uuid.New(), projectID)

	require.Error(t, err)
	assert.Equal(t, map[string]int{"/broken": 1, "/working": 1}, counter.hits)
}

func TestTriggerWebhooks_ProjectEventsUseTeamWebhooks(t *testing.T) {
	server, counter := newReceiver(t, nil)
	service, webhookRepo := newTriggerService(t, server.Client())
	teamID := uuid.New()

	webhookRepo.EXPECT().GetByTeamForEvent(mock.Anything, teamID, schema.WebhookEventProjectCreated).Return([]*ent.Webhook{
		{URL: server.URL + "/team"},
	}, nil)

	err := service.TriggerWebhooks(context.Background(), WebhookLevelInfo, schema.WebhookEventProjectCreated, WebhookData{Title: "Project Created"}, teamID, uuid.New())

	require.NoError(t, err)
	assert.Equal(t, map[string]int{"/team": 1}, counter.hits)
}

func TestTriggerWebhooks_NoMatchingWebhooks(t *testing.T) {
	server, counter := newReceiver(t, nil)
	service, webhookRepo := newTriggerService(t, server.Client())
	projectID := uuid.New()

	webhookRepo.EXPECT().GetByProjectForEvent(mock.Anything, projectID, schema.WebhookEventDeploymentQueued).Return(nil, nil)

	err := service.TriggerWebhooks(context.Background(), WebhookLevelDeploymentQueued, schema.WebhookEventDeploymentQueued, WebhookData{}, uuid.New(), projectID)

	require.NoError(t, err)
	assert.Empty(t, counter.hits)
}

func TestWebhookEvent_WebhookType(t *testing.T) {
	for _, event := range allWebhookEventsForTest() {
		expected := schema.WebhookTypeProject
		if event == schema.WebhookEventProjectCreated || event == schema.WebhookEventProjectUpdated || event == schema.WebhookEventProjectDeleted {
			expected = schema.WebhookTypeTeam
		}
		assert.Equal(t, expected, event.WebhookType(), string(event))
	}
}

func allWebhookEventsForTest() []schema.WebhookEvent {
	var events []schema.WebhookEvent
	for _, v := range schema.WebhookEvent("").Values() {
		events = append(events, schema.WebhookEvent(v))
	}
	return events
}

func newManageService(t *testing.T) (*WebhooksService, *mocks_repository_webhook.WebhookRepositoryMock) {
	repo := mocks_repositories.NewRepositoriesMock(t)
	permissionsRepo := mocks_repository_permissions.NewPermissionsRepositoryMock(t)
	webhookRepo := mocks_repository_webhook.NewWebhookRepositoryMock(t)
	repo.EXPECT().Permissions().Return(permissionsRepo)
	repo.EXPECT().Webhooks().Return(webhookRepo).Maybe()
	permissionsRepo.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(nil)
	return &WebhooksService{repo: repo}, webhookRepo
}

func TestCreateWebhook_RejectsEventsOfTheOtherLevel(t *testing.T) {
	service, _ := newManageService(t)

	_, err := service.CreateWebhook(context.Background(), uuid.New(), &models.WebhookCreateInput{
		Type:   schema.WebhookTypeTeam,
		TeamID: uuid.New(),
		URL:    "https://example.com/hook",
		Events: []schema.WebhookEvent{schema.WebhookEventProjectCreated, schema.WebhookEventDeploymentFailed},
	})

	require.Error(t, err)
	var customErr *errdefs.CustomError
	require.ErrorAs(t, err, &customErr)
	assert.Equal(t, errdefs.ErrTypeInvalidInput, customErr.Type)
}

func TestUpdateWebhook_RejectsEventsOfTheOtherLevel(t *testing.T) {
	service, webhookRepo := newManageService(t)
	teamID := uuid.New()
	projectID := uuid.New()
	webhookID := uuid.New()

	webhookRepo.EXPECT().GetByID(mock.Anything, webhookID).Return(&ent.Webhook{
		ID:        webhookID,
		Type:      schema.WebhookTypeProject,
		TeamID:    teamID,
		ProjectID: &projectID,
	}, nil)

	_, err := service.UpdateWebhook(context.Background(), uuid.New(), &models.WebhookUpdateInput{
		ID:        webhookID,
		TeamID:    teamID,
		ProjectID: &projectID,
		Events:    &[]schema.WebhookEvent{schema.WebhookEventProjectDeleted},
	})

	require.Error(t, err)
	var customErr *errdefs.CustomError
	require.ErrorAs(t, err, &customErr)
	assert.Equal(t, errdefs.ErrTypeInvalidInput, customErr.Type)
}
