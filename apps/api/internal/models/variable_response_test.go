package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestVariableResponseRedact(t *testing.T) {
	resolved := "postgres://user:secret@db"
	refValue := "secret"
	resp := &VariableResponse{Variables: []*VariableResponseItem{
		{Type: schema.VariableReferenceSourceTypeService, Name: "DATABASE_URL", Value: "postgres://user:${{pg.PASSWORD}}@db", ResolvedValue: &resolved, References: []VariableReferenceInfo{{Token: "${{pg.PASSWORD}}", Key: "PASSWORD", SourceName: "pg", Resolved: true, ResolvedValue: &refValue}}},
		{Type: schema.VariableReferenceSourceTypeService, Name: "URL_PRIVATE", Value: "http://svc:8080", Provided: true, References: []VariableReferenceInfo{}},
	}}

	resp.Redact()

	assert.True(t, resp.ValuesRedacted)
	for _, item := range resp.Variables {
		assert.Empty(t, item.Value, item.Name)
		assert.Nil(t, item.ResolvedValue, item.Name)
		for _, ref := range item.References {
			assert.Nil(t, ref.ResolvedValue, item.Name)
		}
	}
	assert.Equal(t, "DATABASE_URL", resp.Variables[0].Name, "names stay")
	assert.Equal(t, "PASSWORD", resp.Variables[0].References[0].Key, "reference metadata stays")
	assert.Equal(t, "pg", resp.Variables[0].References[0].SourceName)
	assert.True(t, resp.Variables[1].Provided, "provided flag stays")
}
