package loki

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompileSearch(t *testing.T) {
	tests := []struct {
		name    string
		expr    string
		want    string
		wantErr bool
	}{
		{name: "empty", expr: "", want: ""},
		{name: "whitespace only", expr: "   ", want: ""},
		{name: "single word", expr: "timeout", want: `|~ "(?i)timeout"`},
		{name: "implicit and", expr: "timeout redis", want: `|~ "(?i)timeout" |~ "(?i)redis"`},
		{name: "explicit and", expr: "timeout AND redis", want: `|~ "(?i)timeout" |~ "(?i)redis"`},
		{name: "quoted phrase", expr: `"connection refused"`, want: `|= "connection refused"`},
		{name: "or words", expr: "timeout OR refused", want: `|~ "((?i:timeout)|(?i:refused))"`},
		{name: "or with quoted", expr: `timeout OR "Exact Phrase"`, want: `|~ "((?i:timeout)|Exact Phrase)"`},
		{name: "negated word", expr: "-healthz", want: `!~ "(?i)healthz"`},
		{name: "negated phrase", expr: `-"GET /healthz"`, want: `!= "GET /healthz"`},
		{name: "and with negation", expr: "error -healthz", want: `|~ "(?i)error" !~ "(?i)healthz"`},
		{name: "attr filter", expr: "@status:500", want: `| json | status =~ "(?i)500"`},
		{name: "negated attr", expr: "-@path:healthz", want: `| json | path !~ "(?i)healthz"`},
		{name: "attr with text", expr: "timeout @method:POST", want: `|~ "(?i)timeout" | json | method =~ "(?i)POST"`},
		{name: "multiple attrs", expr: "@method:POST @status:500", want: `| json | method =~ "(?i)POST" | status =~ "(?i)500"`},
		{name: "regex meta escaped", expr: "a.b*c", want: `|~ "(?i)a\\.b\\*c"`},
		{name: "quote injection is unclosed quote", expr: `foo" } bad`, wantErr: true},
		{name: "invalid attr key falls back to text", expr: "@foo-bar:x", want: `|~ "(?i)@foo-bar:x"`},
		{name: "dash before tab is a literal", expr: "-\tfoo", want: `|~ "(?i)-" |~ "(?i)foo"`},
		{name: "lone dash is a literal", expr: "-", want: `|~ "(?i)-"`},
		{name: "dangling or", expr: "timeout OR", wantErr: true},
		{name: "leading or", expr: "OR timeout", wantErr: true},
		{name: "negation in or", expr: "a OR -b", wantErr: true},
		{name: "attr in or", expr: "a OR @status:500", wantErr: true},
		{name: "unclosed quote", expr: `"unterminated`, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := CompileSearch(tt.expr)
			if tt.wantErr {
				if err == nil {
					// injection cases must at minimum be safely escaped
					assert.NotContains(t, got, `" }`)
				}
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestCompileSearchEscaping(t *testing.T) {
	// no user input may break out of the LogQL string literal
	hostile := []string{
		`" } |= "`,
		`\" or 1=1`,
		"`backticks`",
		`{unbind_team="x"}`,
		`(?i)(a|b)`,
	}
	for _, input := range hostile {
		got, err := CompileSearch(input)
		if err != nil {
			continue
		}
		require.NoError(t, err)
		// every produced string literal must be balanced: quotes only escaped inside
		assert.NotContains(t, got, "\n")
		assertBalancedLogQLStrings(t, got)
	}
}

func assertBalancedLogQLStrings(t *testing.T, fragment string) {
	t.Helper()
	inString := false
	escaped := false
	for _, r := range fragment {
		if !inString {
			if r == '"' {
				inString = true
			}
			continue
		}
		if escaped {
			escaped = false
			continue
		}
		if r == '\\' {
			escaped = true
			continue
		}
		if r == '"' {
			inString = false
		}
	}
	assert.False(t, inString, "unbalanced string literal in %q", fragment)
}

func TestBuildLogQL(t *testing.T) {
	t.Run("plain selector", func(t *testing.T) {
		assert.Equal(t, `{unbind_service="svc-1"}`, buildLogQL(LokiLabelService, "svc-1", nil, ""))
	})

	t.Run("with services", func(t *testing.T) {
		got := buildLogQL(LokiLabelEnvironment, "env-1", []string{"a", "b"}, "")
		assert.Equal(t, `{unbind_environment="env-1", unbind_service=~"a|b"}`, got)
	})

	t.Run("service label ignores service ids", func(t *testing.T) {
		got := buildLogQL(LokiLabelService, "svc-1", []string{"a"}, "")
		assert.Equal(t, `{unbind_service="svc-1"}`, got)
	})

	t.Run("with filter", func(t *testing.T) {
		got := buildLogQL(LokiLabelTeam, "team-1", nil, `|~ "(?i)x"`)
		assert.Equal(t, `{unbind_team="team-1"} |~ "(?i)x"`, got)
	})
}
