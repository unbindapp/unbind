package logs_service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_deployment "github.com/unbindapp/unbind-api/mocks/repository/deployment"
)

func TestResolveLokiSelector(t *testing.T) {
	ctx := context.Background()
	serviceID := uuid.New()
	currentDeploymentID := uuid.New()
	historicalDeploymentID := uuid.New()
	startedAt := time.Now().Add(-10 * time.Minute)

	service := &ent.Service{ID: serviceID, CurrentDeploymentID: &currentDeploymentID}
	team := &ent.Team{ID: uuid.New()}

	newService := func(t *testing.T, deployment *ent.Deployment) *LogsService {
		repo := mocks_repositories.NewRepositoriesMock(t)
		deployRepo := mocks_repository_deployment.NewDeploymentRepositoryMock(t)
		repo.EXPECT().Deployment().Return(deployRepo).Maybe()
		deployRepo.EXPECT().GetByID(ctx, deployment.ID).Return(deployment, nil).Maybe()
		return &LogsService{repo: repo}
	}

	t.Run("service log type uses service label", func(t *testing.T) {
		svc := &LogsService{}
		sel, err := svc.resolveLokiSelector(ctx, models.LogTypeService, uuid.Nil, team, nil, nil, service)
		require.NoError(t, err)
		assert.Equal(t, loki.LokiLabelService, sel.label)
		assert.Equal(t, serviceID.String(), sel.labelValue)
		assert.Nil(t, sel.startBound)
	})

	t.Run("current deployment uses service label with start bound", func(t *testing.T) {
		deployment := &ent.Deployment{ID: currentDeploymentID, ServiceID: serviceID, StartedAt: &startedAt}
		svc := newService(t, deployment)
		sel, err := svc.resolveLokiSelector(ctx, models.LogTypeDeployment, currentDeploymentID, team, nil, nil, service)
		require.NoError(t, err)
		assert.Equal(t, loki.LokiLabelService, sel.label)
		assert.Equal(t, serviceID.String(), sel.labelValue)
		require.NotNil(t, sel.startBound)
		assert.Equal(t, startedAt, *sel.startBound)
	})

	t.Run("historical deployment keeps deployment label", func(t *testing.T) {
		deployment := &ent.Deployment{ID: historicalDeploymentID, ServiceID: serviceID, StartedAt: &startedAt}
		svc := newService(t, deployment)
		sel, err := svc.resolveLokiSelector(ctx, models.LogTypeDeployment, historicalDeploymentID, team, nil, nil, service)
		require.NoError(t, err)
		assert.Equal(t, loki.LokiLabelDeployment, sel.label)
		assert.Equal(t, historicalDeploymentID.String(), sel.labelValue)
		assert.Nil(t, sel.startBound)
	})

	t.Run("build logs keep build label for current deployment", func(t *testing.T) {
		deployment := &ent.Deployment{ID: currentDeploymentID, ServiceID: serviceID, StartedAt: &startedAt}
		svc := newService(t, deployment)
		sel, err := svc.resolveLokiSelector(ctx, models.LogTypeBuild, currentDeploymentID, team, nil, nil, service)
		require.NoError(t, err)
		assert.Equal(t, loki.LokiLabelBuild, sel.label)
		assert.Equal(t, currentDeploymentID.String(), sel.labelValue)
		assert.Nil(t, sel.startBound)
	})

	t.Run("deployment not belonging to service is not found", func(t *testing.T) {
		deployment := &ent.Deployment{ID: historicalDeploymentID, ServiceID: uuid.New()}
		svc := newService(t, deployment)
		_, err := svc.resolveLokiSelector(ctx, models.LogTypeDeployment, historicalDeploymentID, team, nil, nil, service)
		assert.Error(t, err)
	})
}

func TestClampLogStart(t *testing.T) {
	bound := time.Now().Add(-1 * time.Hour)

	t.Run("nil bound passes through", func(t *testing.T) {
		start, since := clampLogStart(time.Time{}, 10*time.Minute, nil)
		assert.True(t, start.IsZero())
		assert.Equal(t, 10*time.Minute, since)
	})

	t.Run("unset start floors at bound", func(t *testing.T) {
		start, since := clampLogStart(time.Time{}, 0, &bound)
		assert.Equal(t, bound, start)
		assert.Zero(t, since)
	})

	t.Run("earlier start clamps to bound", func(t *testing.T) {
		start, since := clampLogStart(bound.Add(-1*time.Hour), 0, &bound)
		assert.Equal(t, bound, start)
		assert.Zero(t, since)
	})

	t.Run("later start wins over bound", func(t *testing.T) {
		later := bound.Add(30 * time.Minute)
		start, since := clampLogStart(later, 0, &bound)
		assert.Equal(t, later, start)
		assert.Zero(t, since)
	})

	t.Run("narrower since wins over bound", func(t *testing.T) {
		start, since := clampLogStart(time.Time{}, 10*time.Minute, &bound)
		assert.True(t, start.After(bound))
		assert.Zero(t, since)
	})

	t.Run("wider since clamps to bound", func(t *testing.T) {
		start, since := clampLogStart(time.Time{}, 5*time.Hour, &bound)
		assert.Equal(t, bound, start)
		assert.Zero(t, since)
	})
}
