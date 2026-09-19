package variables_service

import (
	"maps"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func values(pairs ...string) map[string][]byte {
	out := make(map[string][]byte, len(pairs)/2)
	for i := 0; i+1 < len(pairs); i += 2 {
		out[pairs[i]] = []byte(pairs[i+1])
	}
	return out
}

func TestFinalValues(t *testing.T) {
	existing := values("A", "1", "B", "2", "C", "3")

	assert.Equal(t, values("A", "1", "B", "20", "D", "4"), finalValues(existing, values("B", "20", "D", "4"), []string{"C"}, false))
	assert.Equal(t, values("B", "20"), finalValues(existing, values("B", "20"), nil, true))
	assert.Equal(t, values("A", "1", "B", "2", "C", "3"), finalValues(existing, nil, []string{"missing"}, false))
}

func TestChangedKeys(t *testing.T) {
	existing := values("A", "1", "B", "2", "C", "3")

	assert.Empty(t, changedKeys(existing, values("A", "1", "B", "2", "C", "3")))
	assert.Equal(t, []string{"B", "C", "D"}, changedKeys(existing, values("A", "1", "B", "20", "D", "4")))
	assert.Equal(t, []string{"A", "B", "C"}, changedKeys(existing, values()))
}

func TestRenderedValuesChange(t *testing.T) {
	existing := values("PLAIN", "1", "URL", "${{team.HOST}}/api")

	assert.False(t, renderedValuesChange(existing, values("PLAIN", "2", "URL", "${{team.HOST}}/api"), []string{"PLAIN"}))
	assert.True(t, renderedValuesChange(existing, values("PLAIN", "1", "URL", "static"), []string{"URL"}))
	assert.True(t, renderedValuesChange(existing, values("PLAIN", "1", "URL", "${{team.HOST}}/api", "NEW", "${{project.KEY}}"), []string{"NEW"}))
	assert.True(t, renderedValuesChange(existing, values("PLAIN", "1"), []string{"URL"}))
	assert.False(t, renderedValuesChange(existing, existing, nil))
}

func TestProtectedViolation(t *testing.T) {
	existing := values("DATABASE_PASSWORD", "real", "DATABASE_USERNAME", "app", "PLAIN", "1")
	protected := []string{"DATABASE_USERNAME", "DATABASE_PASSWORD", "DATABASE_DEFAULT_DB_NAME"}

	tests := []struct {
		name    string
		upserts map[string][]byte
		deletes []string
		want    string
	}{
		{name: "unprotected change", upserts: values("PLAIN", "2"), deletes: []string{"OTHER"}},
		{name: "stored value re-sent", upserts: values("DATABASE_PASSWORD", "real", "PLAIN", "2")},
		{name: "changed", upserts: values("DATABASE_PASSWORD", "mine"), want: "DATABASE_PASSWORD"},
		{name: "emptied", upserts: values("DATABASE_PASSWORD", ""), want: "DATABASE_PASSWORD"},
		{name: "set before it is generated", upserts: values("DATABASE_DEFAULT_DB_NAME", "db"), want: "DATABASE_DEFAULT_DB_NAME"},
		{name: "deleted", deletes: []string{"DATABASE_USERNAME"}, want: "DATABASE_USERNAME"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			name, violated := protectedViolation(existing, test.upserts, test.deletes, protected)
			assert.Equal(t, test.want, name)
			assert.Equal(t, test.want != "", violated)
		})
	}
}

func TestApplyDerivations(t *testing.T) {
	oldSecret, newSecret := strings.Repeat("ab", 32), strings.Repeat("cd", 32)
	convex := map[string]schema.VariableMetadata{
		"ADMIN_KEY": {DerivedFrom: &schema.VariableDerivation{
			Type:               schema.VariableDerivationConvexAdminKey,
			Sources:            []string{"INSTANCE_SECRET"},
			ConvexInstanceName: "convex",
		}},
		"PLAIN": {DisplayName: "Plain"},
	}
	existing := values("INSTANCE_SECRET", oldSecret, "ADMIN_KEY", "convex|old", "PLAIN", "1")

	t.Run("a new source reissues the derived variable", func(t *testing.T) {
		upserts := values("INSTANCE_SECRET", newSecret)
		require.NoError(t, applyDerivations(existing, upserts, nil, false, convex))
		assert.True(t, strings.HasPrefix(string(upserts["ADMIN_KEY"]), "convex|"))
		assert.NotEqual(t, "convex|old", string(upserts["ADMIN_KEY"]))
	})

	t.Run("an unchanged source leaves the derived variable alone", func(t *testing.T) {
		upserts := values("INSTANCE_SECRET", oldSecret, "PLAIN", "2")
		require.NoError(t, applyDerivations(existing, upserts, nil, false, convex))
		assert.NotContains(t, upserts, "ADMIN_KEY")
	})

	t.Run("an invalid source is rejected", func(t *testing.T) {
		err := applyDerivations(existing, values("INSTANCE_SECRET", "short"), nil, false, convex)
		assert.ErrorContains(t, err, "INSTANCE_SECRET must be 64 hex characters")
	})

	t.Run("a source cannot be deleted", func(t *testing.T) {
		err := applyDerivations(existing, values(), []string{"INSTANCE_SECRET"}, false, convex)
		assert.ErrorContains(t, err, "INSTANCE_SECRET cannot be deleted")
	})

	t.Run("an overwrite that omits the source keeps it", func(t *testing.T) {
		upserts := values("PLAIN", "2")
		require.NoError(t, applyDerivations(existing, upserts, nil, true, convex))
		assert.Equal(t, oldSecret, string(upserts["INSTANCE_SECRET"]))
		assert.NotContains(t, upserts, "ADMIN_KEY")
	})
}

func TestApplyDerivationsChain(t *testing.T) {
	jwtKey := func(role string) schema.VariableMetadata {
		return schema.VariableMetadata{DerivedFrom: &schema.VariableDerivation{
			Type: schema.VariableDerivationJWT, Sources: []string{"JWT_SECRET"}, JWTIssuer: "supabase", JWTRole: role,
		}}
	}
	supabase := map[string]schema.VariableMetadata{
		"ANON_KEY":    jwtKey("anon"),
		"SERVICE_KEY": jwtKey("service_role"),
		"kong.yml": {DerivedFrom: &schema.VariableDerivation{
			Type:    schema.VariableDerivationEmbedded,
			Sources: []string{"ANON_KEY", "DASHBOARD_PASSWORD", "DASHBOARD_USERNAME", "SERVICE_KEY"},
		}},
	}
	kong := "anon: old-anon-jwt\nservice: old-service-jwt\nusername: admin\npassword: old-password\nallow:\n  - admin\n"
	existing := values(
		"JWT_SECRET", strings.Repeat("s", 40), "ANON_KEY", "old-anon-jwt", "SERVICE_KEY", "old-service-jwt",
		"DASHBOARD_USERNAME", "admin", "DASHBOARD_PASSWORD", "old-password", "kong.yml", kong,
	)

	t.Run("a new jwt secret resigns both keys and swaps them inside kong.yml", func(t *testing.T) {
		upserts := values("JWT_SECRET", strings.Repeat("n", 40))
		require.NoError(t, applyDerivations(existing, upserts, nil, false, supabase))

		anon, service := string(upserts["ANON_KEY"]), string(upserts["SERVICE_KEY"])
		assert.Len(t, strings.Split(anon, "."), 3)
		assert.NotEqual(t, anon, service)
		assert.Equal(t,
			"anon: "+anon+"\nservice: "+service+"\nusername: admin\npassword: old-password\nallow:\n  - admin\n",
			string(upserts["kong.yml"]),
		)
	})

	t.Run("a short jwt secret is rejected", func(t *testing.T) {
		err := applyDerivations(existing, values("JWT_SECRET", "too-short"), nil, false, supabase)
		assert.ErrorContains(t, err, "JWT_SECRET must be at least 32 characters")
	})

	t.Run("a new password is swapped into a kong.yml edited in the same write", func(t *testing.T) {
		upserts := values("DASHBOARD_PASSWORD", "new-password-1", "kong.yml", kong+"# mine\n")
		require.NoError(t, applyDerivations(existing, upserts, nil, false, supabase))
		assert.Contains(t, string(upserts["kong.yml"]), "password: new-password-1\n")
		assert.Contains(t, string(upserts["kong.yml"]), "# mine\n")
		assert.NotContains(t, string(upserts["kong.yml"]), "old-password")
	})

	t.Run("an embedded value that would break the file is rejected", func(t *testing.T) {
		for _, password := range []string{"short", "has space in it", "quote'and:colon"} {
			err := applyDerivations(existing, values("DASHBOARD_PASSWORD", password), nil, false, supabase)
			assert.ErrorContains(t, err, "DASHBOARD_PASSWORD is written into kong.yml", password)
		}
	})

	t.Run("a short value that also matches other text is rejected", func(t *testing.T) {
		err := applyDerivations(existing, values("DASHBOARD_USERNAME", "administrator"), nil, false, supabase)
		assert.ErrorContains(t, err, "DASHBOARD_USERNAME is too short to be replaced safely inside kong.yml")
	})

	t.Run("a derived variable the user removed is left alone", func(t *testing.T) {
		withoutKong := maps.Clone(existing)
		delete(withoutKong, "kong.yml")
		upserts := values("DASHBOARD_PASSWORD", "new-password-1")
		require.NoError(t, applyDerivations(withoutKong, upserts, nil, false, supabase))
		assert.NotContains(t, upserts, "kong.yml")
	})
}
