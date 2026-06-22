package servicegroup_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
)

func TestResolveInputs(t *testing.T) {
	def := schema.TemplateDefinition{
		Inputs: []schema.TemplateInput{
			{ID: "input_api_domain", Name: "Cloud Domain", Type: schema.InputTypeHost, Required: true},
			{ID: "input_secret", Name: "Secret", Type: schema.InputTypeVariable},
			{ID: "input_hidden", Name: "Hidden", Type: schema.InputTypeVariable, Hidden: true},
			{ID: "input_db", Name: "Database Size", Type: schema.InputTypeDatabaseSize, Default: new("5")},
			{ID: "input_sr", Name: "SR Domain", Type: schema.InputTypeHost},
		},
		Services: []schema.TemplateService{
			{
				ID:       "service_backend",
				Name:     "Backend",
				InputIDs: []string{"input_api_domain", "input_secret", "input_sr"},
				Variables: []schema.TemplateVariable{
					{Name: "CONVEX_CLOUD_ORIGIN", Generator: &schema.ValueGenerator{Type: schema.GeneratorTypeInput, InputID: "input_api_domain", AddPrefix: "https://"}},
					{Name: "SECRET_VAR", Generator: &schema.ValueGenerator{Type: schema.GeneratorTypeInput, InputID: "input_secret"}},
					{Name: "SR_VAR", Value: "prefix-${INPUT_SR_VALUE}", Generator: &schema.ValueGenerator{Type: schema.GeneratorTypeStringReplace}},
				},
			},
			{ID: "service_db", Name: "Postgres", Type: schema.ServiceTypeDatabase, InputIDs: []string{"input_db"}},
		},
	}

	backend := &ent.Service{ID: uuid.New(), Name: "Backend", KubernetesSecret: "sec-backend"}
	backend.Edges.ServiceConfig = &ent.ServiceConfig{
		Hosts: []schema.HostSpec{
			{Host: "cloud.example.com", TemplateInputID: new("input_api_domain")},
			{Host: "sr.example.com", TemplateInputID: new("input_sr")},
		},
		VariableMetadata: map[string]schema.VariableMetadata{
			"SECRET_VAR": {TemplateInputID: new("input_secret")},
			"ADMIN_KEY":  {DisplayName: "Admin Key", Description: "Login key"},
		},
	}
	db := &ent.Service{ID: uuid.New(), Name: "Postgres"}
	db.Edges.ServiceConfig = &ent.ServiceConfig{DatabaseConfig: &schema.DatabaseConfig{StorageSize: "5Gi"}}

	secrets := map[uuid.UUID]map[string][]byte{backend.ID: {"SECRET_VAR": []byte("mysecret"), "ADMIN_KEY": []byte("key123")}}
	volumes := map[uuid.UUID][]*models.PVCInfo{db.ID: {{ID: "pvc-db", IsDatabase: true, CapacityGB: 5}}}

	resolved := resolveInputs(def, []*ent.Service{backend, db}, secrets, volumes)
	require.Len(t, resolved, 6) // 5 inputs + 1 read-only annotated generated variable

	byID := map[string]*resolvedInput{}
	for i, r := range resolved {
		if i < len(def.Inputs) {
			require.Equal(t, def.Inputs[i].ID, r.state.ID) // input order preserved
		}
		byID[r.state.ID] = r
	}

	admin := byID["ADMIN_KEY"]
	require.NotNil(t, admin)
	require.False(t, admin.state.Editable)
	require.Equal(t, "Admin Key", admin.state.Name)
	require.Equal(t, "key123", admin.state.CurrentValue)
	require.NotNil(t, admin.state.EditableReason)

	host := byID["input_api_domain"]
	require.True(t, host.state.Editable)
	require.Equal(t, "cloud.example.com", host.state.CurrentValue)
	require.NotNil(t, host.state.ServiceID)
	require.Equal(t, backend.ID, *host.state.ServiceID)
	// fan-out includes the input-derived variable
	require.Len(t, host.fanout, 1)
	require.Equal(t, "CONVEX_CLOUD_ORIGIN", host.fanout[0].name)
	res, err := host.fanout[0].gen.Generate(map[string]string{"input_api_domain": "new.example.com"})
	require.NoError(t, err)
	require.Equal(t, "https://new.example.com", res.GeneratedValue)

	secret := byID["input_secret"]
	require.True(t, secret.state.Editable)
	require.Equal(t, "mysecret", secret.state.CurrentValue)

	require.False(t, byID["input_hidden"].state.Editable)

	dbInput := byID["input_db"]
	require.True(t, dbInput.state.Editable)
	require.Equal(t, "5", dbInput.state.CurrentValue)
	require.NotNil(t, dbInput.state.CurrentValueGB)
	require.Equal(t, float64(5), *dbInput.state.CurrentValueGB)
	require.NotNil(t, dbInput.state.DefaultGB)
	require.Equal(t, float64(5), *dbInput.state.DefaultGB)
	require.NotNil(t, dbInput.pvc)

	// string-replaced host input is gated read-only despite having a host target
	sr := byID["input_sr"]
	require.False(t, sr.state.Editable)
	require.NotNil(t, sr.state.EditableReason)
}

func TestParseSizeGB(t *testing.T) {
	for in, want := range map[string]float64{"5": 5, "10Gi": 10, "2GB": 2, " 3 ": 3} {
		got, err := parseSizeGB(in)
		require.NoError(t, err)
		require.Equal(t, want, got)
	}
	_, err := parseSizeGB("abc")
	require.Error(t, err)
}

func TestStringReplacedInputs(t *testing.T) {
	def := schema.TemplateDefinition{
		Inputs: []schema.TemplateInput{{ID: "input_sr"}, {ID: "input_plain"}},
		Services: []schema.TemplateService{{
			Variables: []schema.TemplateVariable{
				{Name: "X", Value: "a-${INPUT_SR_VALUE}-b", Generator: &schema.ValueGenerator{Type: schema.GeneratorTypeStringReplace}},
			},
		}},
	}
	used := stringReplacedInputs(def)
	require.True(t, used["input_sr"])
	require.False(t, used["input_plain"])
}
