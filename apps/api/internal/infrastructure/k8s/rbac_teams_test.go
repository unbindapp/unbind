package k8s

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_team "github.com/unbindapp/unbind-api/mocks/repository/team"
)

// Grants below team level never reach a namespace, and a grant on a deleted team reaches none.
func TestTeamsForPermissionIgnoresNonTeamScopes(t *testing.T) {
	teamRepo := mocks_repository_team.NewTeamRepositoryMock(t)
	repo := mocks_repositories.NewRepositoriesMock(t)
	repo.EXPECT().Team().Return(teamRepo).Maybe()
	manager := NewRBACManager(repo, &KubeClient{})

	projectID := uuid.New()
	group := &ent.Group{Edges: ent.GroupEdges{Permissions: []*ent.Permission{
		{ResourceType: entSchema.ResourceTypeProject, ResourceSelector: entSchema.ResourceSelector{ID: projectID}},
		{ResourceType: entSchema.ResourceTypeSystem, ResourceSelector: entSchema.ResourceSelector{Superuser: true}},
		{ResourceType: entSchema.ResourceTypeTeam, ResourceSelector: entSchema.ResourceSelector{ID: uuid.New()}},
	}}}
	teamPerms := teamPermissions(group)
	require.Len(t, teamPerms, 1)

	teamRepo.EXPECT().GetByID(t.Context(), teamPerms[0].ResourceSelector.ID).Return(nil, &ent.NotFoundError{}).Once()
	teams, err := manager.teamsForPermission(t.Context(), teamPerms[0])
	require.NoError(t, err)
	require.Empty(t, teams)
}
