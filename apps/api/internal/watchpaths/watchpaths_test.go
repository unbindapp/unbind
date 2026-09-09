package watchpaths

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldDeploy(t *testing.T) {
	tests := []struct {
		name     string
		patterns []string
		changed  []string
		want     bool
	}{
		{"no patterns deploys everything", nil, []string{"README.md"}, true},
		{"no patterns and no files", nil, nil, true},
		{"patterns but no files", []string{"apps/**"}, nil, false},
		{"directory glob matches nested file", []string{"apps/server/**"}, []string{"apps/server/cmd/main.go"}, true},
		{"anchored directory glob", []string{"/apps/server/**"}, []string{"apps/server/main.go"}, true},
		{"directory glob ignores sibling", []string{"apps/server/**"}, []string{"apps/web/index.ts"}, false},
		{"bare directory matches contents", []string{"apps/server"}, []string{"apps/server/main.go"}, true},
		{"extension glob anywhere", []string{"*.md"}, []string{"docs/guide/intro.md"}, true},
		{"double star extension glob", []string{"**/*.ts"}, []string{"apps/web/src/main.ts"}, true},
		{"anchored root file only", []string{"/package.json"}, []string{"apps/web/package.json"}, false},
		{"anchored root file", []string{"/package.json"}, []string{"package.json"}, true},
		{"unanchored file matches nested", []string{"package.json"}, []string{"apps/web/package.json"}, true},
		{"negation excludes docs", []string{"apps/**", "!apps/**/*.md"}, []string{"apps/web/README.md"}, false},
		{"negation keeps code", []string{"apps/**", "!apps/**/*.md"}, []string{"apps/web/README.md", "apps/web/main.go"}, true},
		{"later pattern wins", []string{"!apps/**/*.md", "apps/**"}, []string{"apps/web/README.md"}, true},
		{"leading slash on changed file", []string{"apps/**"}, []string{"/apps/web/main.go"}, true},
		{"one match among many", []string{"packages/**"}, []string{"a.txt", "b.txt", "packages/x/y.go"}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ShouldDeploy(tt.patterns, tt.changed))
		})
	}
}

func TestClean(t *testing.T) {
	cleaned, err := Clean([]string{" apps/** ", "", "apps/**", "!apps/**/*.md", "  "})
	require.NoError(t, err)
	assert.Equal(t, []string{"apps/**", "!apps/**/*.md"}, cleaned)

	_, err = Clean([]string{strings.Repeat("a", MaxPatternLength+1)})
	assert.Error(t, err)

	tooMany := make([]string, MaxPatterns+1)
	for i := range tooMany {
		tooMany[i] = strings.Repeat("a", i+1)
	}
	_, err = Clean(tooMany)
	assert.Error(t, err)

	cleaned, err = Clean(nil)
	require.NoError(t, err)
	assert.Empty(t, cleaned)
}

func TestSuggestions(t *testing.T) {
	files := []string{
		"package.json",
		"apps/web/src/main.tsx",
		"apps/web/src/app.css",
		"apps/api/main.go",
		"/apps/api/go.mod",
		"Makefile",
		".gitignore",
		"apps/web/.env.example",
	}
	assert.Equal(t, []string{
		"/**/*.css",
		"/**/*.example",
		"/**/*.go",
		"/**/*.json",
		"/**/*.mod",
		"/**/*.tsx",
		"/.gitignore",
		"/Makefile",
		"/apps/**",
		"/apps/**/*.css",
		"/apps/**/*.example",
		"/apps/**/*.go",
		"/apps/**/*.mod",
		"/apps/**/*.tsx",
		"/apps/api/**",
		"/apps/api/**/*.go",
		"/apps/api/**/*.mod",
		"/apps/web/**",
		"/apps/web/**/*.css",
		"/apps/web/**/*.example",
		"/apps/web/**/*.tsx",
		"/apps/web/src/**",
		"/apps/web/src/**/*.css",
		"/apps/web/src/**/*.tsx",
		"/package.json",
	}, Suggestions(files))
	assert.Empty(t, Suggestions(nil))
}
