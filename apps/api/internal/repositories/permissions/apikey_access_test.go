package permissions_repo

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestAPIKeyAccessAllows(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()
	otherProjectID := uuid.New()
	projectHierarchy := []ResourceHierarchyInfo{{ResourceType: schema.ResourceTypeTeam, ResourceID: teamID}}
	scopedToProject := APIKeyAccess{Role: schema.ActionEditor, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeProject, ResourceID: projectID}}}
	scopedToTeam := APIKeyAccess{Role: schema.ActionEditor, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeTeam, ResourceID: teamID}}}
	fullViewer := APIKeyAccess{Role: schema.ActionViewer, FullAccess: true}
	fullAdmin := APIKeyAccess{Role: schema.ActionAdmin, FullAccess: true}

	tests := map[string]struct {
		access       APIKeyAccess
		action       schema.PermittedAction
		resourceType schema.ResourceType
		resourceID   uuid.UUID
		hierarchy    []ResourceHierarchyInfo
		want         bool
	}{
		"direct resource":                      {scopedToProject, schema.ActionEditor, schema.ResourceTypeProject, projectID, projectHierarchy, true},
		"weaker action on direct resource":     {scopedToProject, schema.ActionViewer, schema.ResourceTypeProject, projectID, projectHierarchy, true},
		"stronger action than role":            {scopedToProject, schema.ActionAdmin, schema.ResourceTypeProject, projectID, projectHierarchy, false},
		"other resource of same type":          {scopedToProject, schema.ActionViewer, schema.ResourceTypeProject, otherProjectID, projectHierarchy, false},
		"ancestor held":                        {scopedToTeam, schema.ActionEditor, schema.ResourceTypeProject, projectID, projectHierarchy, true},
		"ancestor not held":                    {scopedToProject, schema.ActionViewer, schema.ResourceTypeTeam, teamID, nil, false},
		"scoped key never reaches system":      {scopedToTeam, schema.ActionViewer, schema.ResourceTypeSystem, uuid.Nil, nil, false},
		"scoped key never matches a nil id":    {scopedToProject, schema.ActionViewer, schema.ResourceTypeProject, uuid.Nil, nil, false},
		"full access reaches anything at role": {fullViewer, schema.ActionViewer, schema.ResourceTypeProject, otherProjectID, nil, true},
		"full access reaches system":           {fullAdmin, schema.ActionAdmin, schema.ResourceTypeSystem, uuid.Nil, nil, true},
		"full access still capped at role":     {fullViewer, schema.ActionEditor, schema.ResourceTypeProject, projectID, projectHierarchy, false},
		"full access nil id at role":           {fullAdmin, schema.ActionEditor, schema.ResourceTypeTeam, uuid.Nil, nil, true},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.access.allows(tt.action, tt.resourceType, tt.resourceID, tt.hierarchy))
		})
	}
}

func TestAPIKeyAccessSet(t *testing.T) {
	projectID := uuid.New()
	scoped := APIKeyAccess{Role: schema.ActionEditor, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeProject, ResourceID: projectID}}}
	full := APIKeyAccess{Role: schema.ActionEditor, FullAccess: true}

	set, unrestricted := full.accessSet(impliedActionsFor(schema.ActionViewer))
	assert.True(t, unrestricted)
	assert.Empty(t, set.ids)

	set, unrestricted = full.accessSet(impliedActionsFor(schema.ActionAdmin))
	assert.False(t, unrestricted, "a full-access editor key must not list admin-only rows")
	assert.Empty(t, set.ids)
	assert.Empty(t, set.all)

	set, unrestricted = scoped.accessSet(impliedActionsFor(schema.ActionEditor))
	assert.False(t, unrestricted)
	assert.Equal(t, []uuid.UUID{projectID}, set.ids[schema.ResourceTypeProject])
	assert.Empty(t, set.all)

	set, _ = scoped.accessSet(impliedActionsFor(schema.ActionAdmin))
	assert.Empty(t, set.ids, "role below the action yields nothing")
}

func TestAPIKeyAccessGrants(t *testing.T) {
	projectID := uuid.New()

	g := APIKeyAccess{Role: schema.ActionViewer, FullAccess: true}.grants()
	for _, resourceType := range []schema.ResourceType{schema.ResourceTypeSystem, schema.ResourceTypeTeam, schema.ResourceTypeProject, schema.ResourceTypeEnvironment, schema.ResourceTypeService} {
		assert.Equal(t, schema.ActionViewer, g.superuser[resourceType], string(resourceType))
	}
	assert.Empty(t, g.byID)

	g = APIKeyAccess{Role: schema.ActionAdmin, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeProject, ResourceID: projectID}}}.grants()
	assert.Empty(t, g.superuser)
	assert.Equal(t, schema.ActionAdmin, g.byID[schema.ResourceTypeProject][projectID])
}

func TestAPIKeyAccessWritesAndContext(t *testing.T) {
	assert.False(t, APIKeyAccess{Role: schema.ActionViewer}.AllowsWrites())
	assert.True(t, APIKeyAccess{Role: schema.ActionEditor}.AllowsWrites())
	assert.True(t, APIKeyAccess{Role: schema.ActionAdmin}.AllowsWrites())

	_, ok := APIKeyAccessFromContext(context.Background())
	assert.False(t, ok, "sessions carry no key access")

	key := &ent.APIKey{Role: schema.ActionEditor, FullAccess: true, Privileges: []schema.KeyPrivilege{schema.PrivilegeReadLogs}}
	got, ok := APIKeyAccessFromContext(WithAPIKeyAccess(context.Background(), APIKeyAccessOf(key)))
	assert.True(t, ok)
	assert.Equal(t, APIKeyAccess{Role: schema.ActionEditor, FullAccess: true, Privileges: []schema.KeyPrivilege{schema.PrivilegeReadLogs}}, got)
}

func TestHasPrivilege(t *testing.T) {
	assert.True(t, HasPrivilege(context.Background(), schema.PrivilegeReadVariableValues), "sessions hold every privilege")

	none := WithAPIKeyAccess(context.Background(), APIKeyAccess{Role: schema.ActionAdmin, FullAccess: true})
	assert.False(t, HasPrivilege(none, schema.PrivilegeReadVariableValues), "admin alone grants nothing")
	assert.False(t, HasPrivilege(none, schema.PrivilegeReadLogs))
	assert.False(t, HasPrivilege(none, schema.PrivilegeReadWebhookURLs))

	logs := WithAPIKeyAccess(context.Background(), APIKeyAccess{Role: schema.ActionViewer, FullAccess: true, Privileges: []schema.KeyPrivilege{schema.PrivilegeReadLogs}})
	assert.True(t, HasPrivilege(logs, schema.PrivilegeReadLogs))
	assert.False(t, HasPrivilege(logs, schema.PrivilegeReadWebhookURLs))
}
