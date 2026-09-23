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
	assert.NoError(t, Validate(Spec{Role: schema.ActionEditor, FullAccess: true, Capabilities: []schema.KeyCapability{schema.CapabilityVariableValues, schema.CapabilityLogs, schema.CapabilityWebhookURLs}}))
	assert.NoError(t, Validate(Spec{Role: schema.ActionViewer, FullAccess: true, Capabilities: []schema.KeyCapability{schema.CapabilityLogs, schema.CapabilityWebhookURLs}}))

	cases := map[string]Spec{
		"unknown role":         {Role: "owner", FullAccess: true},
		"full access and list": {Role: schema.ActionAdmin, FullAccess: true, Resources: []schema.APIKeyResource{project}},
		"nothing":              {Role: schema.ActionAdmin},
		"system resource":      {Role: schema.ActionAdmin, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeSystem, ResourceID: uuid.New()}}},
		"nil id":               {Role: schema.ActionAdmin, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeTeam}}},
		"duplicate":            {Role: schema.ActionAdmin, Resources: []schema.APIKeyResource{project, project}},
		"unknown capability":   {Role: schema.ActionAdmin, FullAccess: true, Capabilities: []schema.KeyCapability{"terminal"}},
		"duplicate capability": {Role: schema.ActionAdmin, FullAccess: true, Capabilities: []schema.KeyCapability{schema.CapabilityLogs, schema.CapabilityLogs}},
		"viewer with values":   {Role: schema.ActionViewer, FullAccess: true, Capabilities: []schema.KeyCapability{schema.CapabilityVariableValues}},
	}
	for name, spec := range cases {
		assert.Error(t, Validate(spec), name)
	}

	assert.Equal(t, []schema.KeyCapability{}, Capabilities(Spec{}), "stored and returned as a list, never null")
}
