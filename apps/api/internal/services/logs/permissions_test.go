package logs_service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_deployment "github.com/unbindapp/unbind-api/mocks/repository/deployment"
	mocks_repository_environment "github.com/unbindapp/unbind-api/mocks/repository/environment"
	mocks_repository_permissions "github.com/unbindapp/unbind-api/mocks/repository/permissions"
	mocks_repository_project "github.com/unbindapp/unbind-api/mocks/repository/project"
	mocks_repository_service "github.com/unbindapp/unbind-api/mocks/repository/service"
	mocks_repository_team "github.com/unbindapp/unbind-api/mocks/repository/team"
)

func TestPermissionCheckForType(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()
	environmentID := uuid.New()
	serviceID := uuid.New()

	cases := []struct {
		logType      models.LogType
		resourceType schema.ResourceType
		resourceID   uuid.UUID
	}{
		{models.LogTypeTeam, schema.ResourceTypeTeam, teamID},
		{models.LogTypeProject, schema.ResourceTypeProject, projectID},
		{models.LogTypeEnvironment, schema.ResourceTypeEnvironment, environmentID},
		{models.LogTypeService, schema.ResourceTypeService, serviceID},
		{models.LogTypeDeployment, schema.ResourceTypeService, serviceID},
		{models.LogTypeBuild, schema.ResourceTypeService, serviceID},
	}

	for _, c := range cases {
		t.Run(string(c.logType), func(t *testing.T) {
			check, err := permissionCheckForType(c.logType, teamID, projectID, environmentID, serviceID)
			require.NoError(t, err)
			assert.Equal(t, schema.ActionViewer, check.Action)
			assert.Equal(t, c.resourceType, check.ResourceType)
			assert.Equal(t, c.resourceID, check.ResourceID)
		})
	}
}

func TestPermissionCheckForType_MissingID(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()
	environmentID := uuid.New()

	cases := []struct {
		name          string
		logType       models.LogType
		teamID        uuid.UUID
		projectID     uuid.UUID
		environmentID uuid.UUID
	}{
		{"team", models.LogTypeTeam, uuid.Nil, uuid.Nil, uuid.Nil},
		{"project", models.LogTypeProject, teamID, uuid.Nil, uuid.Nil},
		{"environment", models.LogTypeEnvironment, teamID, projectID, uuid.Nil},
		{"service", models.LogTypeService, teamID, projectID, environmentID},
		{"deployment", models.LogTypeDeployment, teamID, projectID, environmentID},
		{"build", models.LogTypeBuild, teamID, projectID, environmentID},
		{"unknown type", models.LogType("cluster"), teamID, projectID, environmentID},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := permissionCheckForType(c.logType, c.teamID, c.projectID, c.environmentID, uuid.Nil)
			assert.ErrorIs(t, err, errdefs.ErrInvalidInput)
		})
	}
}

func TestBuildLogsAreScopedToTheService(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	teamID := uuid.New()
	projectID := uuid.New()
	environmentID := uuid.New()
	serviceID := uuid.New()
	foreignDeployment := &ent.Deployment{ID: uuid.New(), ServiceID: uuid.New()}

	repo := mocks_repositories.NewRepositoriesMock(t)
	permissionsRepo := mocks_repository_permissions.NewPermissionsRepositoryMock(t)
	teamRepo := mocks_repository_team.NewTeamRepositoryMock(t)
	projectRepo := mocks_repository_project.NewProjectRepositoryMock(t)
	environmentRepo := mocks_repository_environment.NewEnvironmentRepositoryMock(t)
	serviceRepo := mocks_repository_service.NewServiceRepositoryMock(t)
	deploymentRepo := mocks_repository_deployment.NewDeploymentRepositoryMock(t)
	repo.EXPECT().Permissions().Return(permissionsRepo)
	repo.EXPECT().Team().Return(teamRepo)
	repo.EXPECT().Project().Return(projectRepo)
	repo.EXPECT().Environment().Return(environmentRepo)
	repo.EXPECT().Service().Return(serviceRepo)
	repo.EXPECT().Deployment().Return(deploymentRepo)

	permissionsRepo.EXPECT().Check(ctx, userID, []permissions_repo.PermissionCheck{{
		Action:       schema.ActionViewer,
		ResourceType: schema.ResourceTypeService,
		ResourceID:   serviceID,
	}}).Return(nil)
	teamRepo.EXPECT().GetByID(ctx, teamID).Return(&ent.Team{ID: teamID}, nil)
	projectRepo.EXPECT().GetByID(ctx, projectID).Return(&ent.Project{ID: projectID, TeamID: teamID}, nil)
	environmentRepo.EXPECT().GetByID(ctx, environmentID).Return(&ent.Environment{ID: environmentID, ProjectID: projectID}, nil)
	serviceRepo.EXPECT().GetByID(ctx, serviceID).Return(&ent.Service{ID: serviceID, EnvironmentID: environmentID}, nil)
	deploymentRepo.EXPECT().GetByID(ctx, foreignDeployment.ID).Return(foreignDeployment, nil)

	svc := &LogsService{repo: repo}
	team, project, environment, service, err := svc.validatePermissionsAndParseInputs(ctx, userID, models.LogTypeBuild, teamID, projectID, environmentID, serviceID)
	require.NoError(t, err)
	require.NotNil(t, service)

	_, err = svc.resolveLokiSelector(ctx, models.LogTypeBuild, foreignDeployment.ID, team, project, environment, service)
	assert.ErrorIs(t, err, errdefs.ErrNotFound)
}
