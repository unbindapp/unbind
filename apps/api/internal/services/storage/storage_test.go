package storage_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
)

func TestPermissionCheckForScope(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()
	environmentID := uuid.New()

	cases := []struct {
		scope        models.PvcScope
		action       schema.PermittedAction
		resourceType schema.ResourceType
		resourceID   uuid.UUID
	}{
		{models.PvcScopeTeam, schema.ActionViewer, schema.ResourceTypeTeam, teamID},
		{models.PvcScopeProject, schema.ActionEditor, schema.ResourceTypeProject, projectID},
		{models.PvcScopeEnvironment, schema.ActionEditor, schema.ResourceTypeEnvironment, environmentID},
	}

	for _, c := range cases {
		t.Run(string(c.scope), func(t *testing.T) {
			check, err := permissionCheckForScope(c.action, c.scope, teamID, projectID, environmentID)
			require.NoError(t, err)
			assert.Equal(t, c.action, check.Action)
			assert.Equal(t, c.resourceType, check.ResourceType)
			assert.Equal(t, c.resourceID, check.ResourceID)
		})
	}
}

func TestPermissionCheckForScope_MissingID(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()

	cases := []struct {
		name      string
		scope     models.PvcScope
		teamID    uuid.UUID
		projectID uuid.UUID
	}{
		{"team", models.PvcScopeTeam, uuid.Nil, uuid.Nil},
		{"project", models.PvcScopeProject, teamID, uuid.Nil},
		{"environment", models.PvcScopeEnvironment, teamID, projectID},
		{"unknown type", models.PvcScope("cluster"), teamID, projectID},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := permissionCheckForScope(schema.ActionEditor, c.scope, c.teamID, c.projectID, uuid.Nil)
			assert.ErrorIs(t, err, errdefs.ErrInvalidInput)
		})
	}
}
