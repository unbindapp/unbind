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
	assert.Equal(t, "UNBIND_URL_PRIVATE", EndpointKey(KeyURLPrivate, 0, 0))
	assert.Equal(t, "UNBIND_URL_PRIVATE_8080", EndpointKey(KeyURLPrivate, 8080, 1))
	assert.Equal(t, "UNBIND_URL_PUBLIC_8080_2", EndpointKey(KeyURLPublic, 8080, 2))
	assert.Equal(t, "UNBIND_DATABASE_URL_PUBLIC_9000", EndpointKey(KeyDatabaseURLPublic, 9000, 0))
}

func TestParseEndpointKey(t *testing.T) {
	ref, ok := ParseEndpointKey("UNBIND_PORT_PRIVATE")
	assert.True(t, ok)
	assert.Equal(t, EndpointRef{Base: KeyPortPrivate}, ref)

	ref, ok = ParseEndpointKey("UNBIND_URL_PUBLIC_8080")
	assert.True(t, ok)
	assert.Equal(t, EndpointRef{Base: KeyURLPublic, Port: 8080}, ref)

	ref, ok = ParseEndpointKey("UNBIND_URL_PUBLIC_8080_2")
	assert.True(t, ok)
	assert.Equal(t, EndpointRef{Base: KeyURLPublic, Port: 8080, Tiebreak: 2}, ref)

	// The database bases share a prefix shape with the plain URL ones
	ref, ok = ParseEndpointKey("UNBIND_DATABASE_URL_PRIVATE_5432")
	assert.True(t, ok)
	assert.Equal(t, EndpointRef{Base: KeyDatabaseURLPrivate, Port: 5432}, ref)

	_, ok = ParseEndpointKey("UNBIND_URL_PUBLIC_0")
	assert.False(t, ok)
	_, ok = ParseEndpointKey("DATABASE_URL")
	assert.False(t, ok)
	_, ok = ParseEndpointKey("UNBIND_OTHER")
	assert.False(t, ok)
	assert.True(t, IsEndpointKey("UNBIND_DOMAIN_PUBLIC"))
}

// Keys written before the public/private rename still resolve, by position
func TestParseEndpointKeyLegacy(t *testing.T) {
	ref, ok := ParseEndpointKey("UNBIND_INTERNAL_HOST")
	assert.True(t, ok)
	assert.Equal(t, EndpointRef{Base: KeyHostPrivate, Index: 1, Legacy: true}, ref)

	ref, ok = ParseEndpointKey("UNBIND_EXTERNAL_URL_12")
	assert.True(t, ok)
	assert.Equal(t, EndpointRef{Base: KeyURLPublic, Index: 12, Legacy: true}, ref)

	_, ok = ParseEndpointKey("UNBIND_EXTERNAL_URL_0")
	assert.False(t, ok)
	// A legacy key never carries a tiebreaker
	_, ok = ParseEndpointKey("UNBIND_EXTERNAL_URL_1_2")
	assert.False(t, ok)
}

func TestRenameLegacyEndpointKeys(t *testing.T) {
	id := uuid.New()
	rename := func(_ Token, ref EndpointRef) (string, bool) {
		return EndpointKey(ref.Base, int32(ref.Index*1000), 1), true
	}

	value := "a=" + ServiceToken(id, "UNBIND_EXTERNAL_URL_2") + " b=" + ServiceToken(id, "DATABASE_URL")
	renamed, changed := RenameLegacyEndpointKeys(value, rename)
	assert.True(t, changed)
	assert.Equal(t, "a="+ServiceToken(id, "UNBIND_URL_PUBLIC_2000")+" b="+ServiceToken(id, "DATABASE_URL"), renamed)

	// Nothing legacy, nothing rewritten
	renamed, changed = RenameLegacyEndpointKeys(ServiceToken(id, "UNBIND_URL_PUBLIC"), rename)
	assert.False(t, changed)
	assert.Equal(t, ServiceToken(id, "UNBIND_URL_PUBLIC"), renamed)
}
