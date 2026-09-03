package vartemplate

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestParse(t *testing.T) {
	serviceID := uuid.MustParse("3f2a9c1e-7b4d-4e8a-9f0c-1d2e3f4a5b6c")
	value := "postgres://${{service.3f2a9c1e-7b4d-4e8a-9f0c-1d2e3f4a5b6c.DATABASE_HOST}}:${{team.PORT}}/${{service.3f2a9c1e-7b4d-4e8a-9f0c-1d2e3f4a5b6c.DATABASE_HOST}} ${not-a-token} ${{nope.KEY}} ${{service.abc.KEY}}"

	tokens := Parse(value)
	require.Len(t, tokens, 2)
	assert.Equal(t, Token{
		Raw:        "${{service.3f2a9c1e-7b4d-4e8a-9f0c-1d2e3f4a5b6c.DATABASE_HOST}}",
		SourceType: schema.VariableReferenceSourceTypeService,
		SourceID:   serviceID,
		Key:        "DATABASE_HOST",
	}, tokens[0])
	assert.Equal(t, Token{
		Raw:        "${{team.PORT}}",
		SourceType: schema.VariableReferenceSourceTypeTeam,
		Key:        "PORT",
	}, tokens[1])
}

func TestParse_NoTokens(t *testing.T) {
	assert.Nil(t, Parse("plain ${value} $${{}} ${{service.KEY}}"))
	assert.False(t, HasTokens("plain ${service.x.KEY}"))
	assert.True(t, HasTokens("${{project.KEY}}"))
}

func TestRender(t *testing.T) {
	serviceID := uuid.New()
	value := "a=" + ServiceToken(serviceID, "A") + " b=" + ScopeToken(schema.VariableReferenceSourceTypeEnvironment, "B") + " again=" + ServiceToken(serviceID, "A") + " missing=" + ScopeToken(schema.VariableReferenceSourceTypeTeam, "MISSING") + " literal=${plain}"

	rendered, unresolved := Render(value, func(token Token) (string, bool) {
		switch {
		case token.SourceType == schema.VariableReferenceSourceTypeService && token.SourceID == serviceID && token.Key == "A":
			return "1", true
		case token.SourceType == schema.VariableReferenceSourceTypeEnvironment && token.Key == "B":
			return "2", true
		}
		return "", false
	})

	assert.Equal(t, "a=1 b=2 again=1 missing=${{team.MISSING}} literal=${plain}", rendered)
	require.Len(t, unresolved, 1)
	assert.Equal(t, "MISSING", unresolved[0].Key)
	assert.Equal(t, schema.VariableReferenceSourceTypeTeam, unresolved[0].SourceType)
}

func TestRender_NoTokensIsIdentity(t *testing.T) {
	rendered, unresolved := Render("nothing here ${{}}", func(Token) (string, bool) { return "x", true })
	assert.Equal(t, "nothing here ${{}}", rendered)
	assert.Empty(t, unresolved)
}

func TestEndpointKeys(t *testing.T) {
	assert.Equal(t, "UNBIND_INTERNAL_URL", EndpointKey(KeyInternalURL, 1))
	assert.Equal(t, "UNBIND_INTERNAL_URL", EndpointKey(KeyInternalURL, 0))
	assert.Equal(t, "UNBIND_EXTERNAL_URL_3", EndpointKey(KeyExternalURL, 3))

	base, index, ok := ParseEndpointKey("UNBIND_INTERNAL_PORT")
	assert.True(t, ok)
	assert.Equal(t, KeyInternalPort, base)
	assert.Equal(t, 1, index)

	base, index, ok = ParseEndpointKey("UNBIND_EXTERNAL_URL_12")
	assert.True(t, ok)
	assert.Equal(t, KeyExternalURL, base)
	assert.Equal(t, 12, index)

	_, _, ok = ParseEndpointKey("UNBIND_EXTERNAL_URL_0")
	assert.False(t, ok)
	_, _, ok = ParseEndpointKey("DATABASE_URL")
	assert.False(t, ok)
	assert.True(t, IsEndpointKey("UNBIND_INTERNAL_HOST"))
	assert.False(t, IsEndpointKey("UNBIND_OTHER"))
}
