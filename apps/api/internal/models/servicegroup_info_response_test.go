package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestServiceGroupInfoResponseRedact(t *testing.T) {
	resp := &ServiceGroupInfoResponse{Services: []*ServiceGroupServiceInfo{{
		Name:      "Backend",
		Hosts:     []*ServiceGroupHostInfo{{Host: "cloud.example.com"}},
		Variables: []*ServiceGroupVariableInfo{{Name: "ADMIN_KEY", DisplayName: "Admin Key", Value: "key123"}},
	}}}

	resp.Redact()

	assert.True(t, resp.ValuesRedacted)
	assert.Empty(t, resp.Services[0].Variables[0].Value)
	assert.Equal(t, "ADMIN_KEY", resp.Services[0].Variables[0].Name, "names stay")
	assert.Equal(t, "Admin Key", resp.Services[0].Variables[0].DisplayName)
	assert.Equal(t, "cloud.example.com", resp.Services[0].Hosts[0].Host, "hosts stay")
}

func TestServiceGroupTemplateInputsResponseRedact(t *testing.T) {
	size := 5.0
	resp := &ServiceGroupTemplateInputsResponse{Inputs: []*DeployedTemplateInput{
		{ID: "input_secret", Type: schema.InputTypeVariable, CurrentValue: "mysecret", Editable: true},
		{ID: "ADMIN_KEY", Type: schema.InputTypeVariable, CurrentValue: "key123"},
		{ID: "input_domain", Type: schema.InputTypeHost, CurrentValue: "cloud.example.com"},
		{ID: "input_db", Type: schema.InputTypeDatabaseSize, CurrentValue: "5", CurrentValueGB: &size},
	}}

	resp.Redact()

	assert.True(t, resp.ValuesRedacted)
	assert.Empty(t, resp.Inputs[0].CurrentValue)
	assert.True(t, resp.Inputs[0].Editable, "editability is not a secret")
	assert.Empty(t, resp.Inputs[1].CurrentValue)
	assert.Equal(t, "cloud.example.com", resp.Inputs[2].CurrentValue, "hosts stay")
	assert.Equal(t, "5", resp.Inputs[3].CurrentValue, "sizes stay")
	assert.Equal(t, &size, resp.Inputs[3].CurrentValueGB)
}
