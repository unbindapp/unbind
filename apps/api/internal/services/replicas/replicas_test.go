package replica_service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_permissions "github.com/unbindapp/unbind-api/mocks/repository/permissions"
	mocks_repository_team "github.com/unbindapp/unbind-api/mocks/repository/team"
	"k8s.io/client-go/kubernetes/fake"
)

func TestPermissionCheckForType(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()
	environmentID := uuid.New()
	serviceID := uuid.New()

	cases := []struct {
		replicaType  models.ReplicaType
		resourceType schema.ResourceType
		resourceID   uuid.UUID
	}{
		{models.ReplicaTypeTeam, schema.ResourceTypeTeam, teamID},
		{models.ReplicaTypeProject, schema.ResourceTypeProject, projectID},
		{models.ReplicaTypeEnvironment, schema.ResourceTypeEnvironment, environmentID},
		{models.ReplicaTypeService, schema.ResourceTypeService, serviceID},
	}

	for _, c := range cases {
		t.Run(string(c.replicaType), func(t *testing.T) {
			check, err := permissionCheckForType(c.replicaType, teamID, projectID, environmentID, serviceID)
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
		replicaType   models.ReplicaType
		teamID        uuid.UUID
		projectID     uuid.UUID
		environmentID uuid.UUID
	}{
		{"team", models.ReplicaTypeTeam, uuid.Nil, uuid.Nil, uuid.Nil},
		{"project", models.ReplicaTypeProject, teamID, uuid.Nil, uuid.Nil},
		{"environment", models.ReplicaTypeEnvironment, teamID, projectID, uuid.Nil},
		{"service", models.ReplicaTypeService, teamID, projectID, environmentID},
		{"unknown type", models.ReplicaType("cluster"), teamID, projectID, environmentID},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := permissionCheckForType(c.replicaType, c.teamID, c.projectID, c.environmentID, uuid.Nil)
			assert.ErrorIs(t, err, errdefs.ErrInvalidInput)
		})
	}
}

func TestGetReplicaStatuses_TeamType(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	team := &ent.Team{ID: uuid.New(), Namespace: "unbind-team"}
	client := fake.NewSimpleClientset()
	statuses := []k8s.PodContainerStatus{{}}

	repo := mocks_repositories.NewRepositoriesMock(t)
	permissionsRepo := mocks_repository_permissions.NewPermissionsRepositoryMock(t)
	teamRepo := mocks_repository_team.NewTeamRepositoryMock(t)
	kubeClient := mocks_infrastructure_k8s.NewKubeClientMock(t)
	repo.EXPECT().Permissions().Return(permissionsRepo)
	repo.EXPECT().Team().Return(teamRepo)

	permissionsRepo.EXPECT().Check(ctx, userID, []permissions_repo.PermissionCheck{{
		Action:       schema.ActionViewer,
		ResourceType: schema.ResourceTypeTeam,
		ResourceID:   team.ID,
	}}).Return(nil)
	teamRepo.EXPECT().GetByID(ctx, team.ID).Return(team, nil)
	kubeClient.EXPECT().GetInternalClient().Return(client)
	kubeClient.EXPECT().
		GetPodContainerStatusByLabels(ctx, team.Namespace, map[string]string{"unbind-team": team.ID.String()}, client).
		Return(statuses, nil)

	svc := &ReplicaService{repo: repo, k8s: kubeClient}
	result, err := svc.GetReplicaStatuses(ctx, userID, &models.ReplicaStatusInput{Type: models.ReplicaTypeTeam, TeamID: team.ID})
	require.NoError(t, err)
	assert.Equal(t, statuses, result)
}
