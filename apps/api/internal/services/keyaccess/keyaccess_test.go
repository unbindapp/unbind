package keyaccess

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestValidate(t *testing.T) {
	project := schema.APIKeyResource{ResourceType: schema.ResourceTypeProject, ResourceID: uuid.New()}

	assert.NoError(t, Validate(Spec{Role: schema.ActionViewer, FullAccess: true}))
	assert.NoError(t, Validate(Spec{Role: schema.ActionEditor, Resources: []schema.APIKeyResource{project}}))
	assert.NoError(t, Validate(Spec{Role: schema.ActionEditor, FullAccess: true, Privileges: []schema.KeyPrivilege{schema.PrivilegeReadVariableValues, schema.PrivilegeReadLogs, schema.PrivilegeReadWebhookURLs}}))
	assert.NoError(t, Validate(Spec{Role: schema.ActionViewer, FullAccess: true, Privileges: []schema.KeyPrivilege{schema.PrivilegeReadVariableValues}}), "privileges do not depend on the role")

	cases := map[string]Spec{
		"unknown role":         {Role: "owner", FullAccess: true},
		"full access and list": {Role: schema.ActionAdmin, FullAccess: true, Resources: []schema.APIKeyResource{project}},
		"nothing":              {Role: schema.ActionAdmin},
		"system resource":      {Role: schema.ActionAdmin, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeSystem, ResourceID: uuid.New()}}},
		"nil id":               {Role: schema.ActionAdmin, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeTeam}}},
		"duplicate":            {Role: schema.ActionAdmin, Resources: []schema.APIKeyResource{project, project}},
		"unknown privilege":    {Role: schema.ActionAdmin, FullAccess: true, Privileges: []schema.KeyPrivilege{"terminal"}},
		"duplicate privilege":  {Role: schema.ActionAdmin, FullAccess: true, Privileges: []schema.KeyPrivilege{schema.PrivilegeReadLogs, schema.PrivilegeReadLogs}},
	}
	for name, spec := range cases {
		assert.Error(t, Validate(spec), name)
	}

	assert.Equal(t, []schema.KeyPrivilege{}, Privileges(Spec{}), "stored and returned as a list, never null")
}
