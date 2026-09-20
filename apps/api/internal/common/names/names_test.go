package names

import (
	"regexp"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

func TestClean(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		wantErr  bool
	}{
		{name: "untouched", input: "bio", expected: "bio"},
		{name: "trims whitespace", input: "  bio \n", expected: "bio"},
		{name: "keeps inner spaces", input: "my app", expected: "my app"},
		{name: "one character is enough", input: " a ", expected: "a"},
		{name: "only whitespace", input: "   ", wantErr: true},
		{name: "empty", input: "", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cleaned, err := Clean(tt.input)
			if tt.wantErr {
				assert.ErrorIs(t, err, errdefs.ErrInvalidInput)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expected, cleaned)
		})
	}
}

func TestIsTakenIsCaseSensitive(t *testing.T) {
	taken := []string{"Bio", "redis"}

	assert.True(t, IsTaken("Bio", taken))
	assert.False(t, IsTaken("bio", taken))
	assert.False(t, IsTaken("Redis", taken))
}

func TestEnsureFree(t *testing.T) {
	assert.NoError(t, EnsureFree("bio", []string{"Bio"}, "project", "team"))

	err := EnsureFree("bio", []string{"bio"}, "project", "team")
	assert.ErrorIs(t, err, errdefs.ErrConflict)
	assert.Contains(t, err.Error(), `A project named "bio" already exists in this team`)

	err = EnsureFree("Default", []string{"Default"}, "team", "")
	assert.Contains(t, err.Error(), `A team named "Default" already exists`)
	assert.NotContains(t, err.Error(), "in this")

	err = EnsureFree("ci", []string{"ci"}, "API key", "")
	assert.Contains(t, err.Error(), `An API key named "ci" already exists`)

	err = EnsureFree("production", []string{"production"}, "environment", "project")
	assert.Contains(t, err.Error(), `An environment named "production" already exists in this project`)
}

func TestUnique(t *testing.T) {
	suffixed := func(base string) *regexp.Regexp {
		return regexp.MustCompile("^" + regexp.QuoteMeta(base) + "-[a-zA-Z0-9]{4}$")
	}

	t.Run("free name is kept", func(t *testing.T) {
		name, err := Unique("bio", []string{"Bio", "other"}, MaxLength)
		require.NoError(t, err)
		assert.Equal(t, "bio", name)
	})

	t.Run("taken name gets a suffix", func(t *testing.T) {
		name, err := Unique("PostgreSQL", []string{"PostgreSQL"}, MaxLength)
		require.NoError(t, err)
		assert.Regexp(t, suffixed("PostgreSQL"), name)
	})

	t.Run("long name is cut to fit the suffix", func(t *testing.T) {
		long := strings.Repeat("a", MaxLength)
		name, err := Unique(long, []string{long}, MaxLength)
		require.NoError(t, err)
		assert.Regexp(t, suffixed(strings.Repeat("a", MaxLength-5)), name)
		assert.Equal(t, MaxLength, utf8.RuneCountInString(name))
	})

	t.Run("multibyte name is cut by runes", func(t *testing.T) {
		long := strings.Repeat("ü", MaxLength)
		name, err := Unique(long, []string{long}, MaxLength)
		require.NoError(t, err)
		assert.True(t, utf8.ValidString(name))
		assert.Equal(t, MaxLength, utf8.RuneCountInString(name))
	})

	t.Run("cut does not leave a dangling separator", func(t *testing.T) {
		long := strings.Repeat("a", MaxLength-6) + "-" + strings.Repeat("b", 5)
		name, err := Unique(long, []string{long}, MaxLength)
		require.NoError(t, err)
		assert.Regexp(t, suffixed(strings.Repeat("a", MaxLength-6)), name)
	})

	t.Run("suffixed name never collides", func(t *testing.T) {
		taken := []string{"bio"}
		for range 200 {
			name, err := Unique("bio", taken, MaxLength)
			require.NoError(t, err)
			assert.False(t, IsTaken(name, taken))
			taken = append(taken, name)
		}
	})
}

func TestUniqueSeeded(t *testing.T) {
	t.Run("free name is kept", func(t *testing.T) {
		assert.Equal(t, "redis-volume", UniqueSeeded("redis-volume", nil, MaxLength, "claim-a"))
	})

	t.Run("same seed gives the same name", func(t *testing.T) {
		taken := []string{"redis-volume"}
		first := UniqueSeeded("redis-volume", taken, MaxLength, "claim-a")
		second := UniqueSeeded("redis-volume", taken, MaxLength, "claim-a")

		assert.Regexp(t, regexp.MustCompile("^redis-volume-[a-z0-9]{4}$"), first)
		assert.Equal(t, first, second)
	})

	t.Run("different seeds give different names", func(t *testing.T) {
		taken := []string{"redis-volume"}
		assert.NotEqual(t,
			UniqueSeeded("redis-volume", taken, MaxLength, "claim-a"),
			UniqueSeeded("redis-volume", taken, MaxLength, "claim-b"),
		)
	})

	t.Run("moves on when the seeded name is taken too", func(t *testing.T) {
		first := UniqueSeeded("redis-volume", []string{"redis-volume"}, MaxLength, "claim-a")
		second := UniqueSeeded("redis-volume", []string{"redis-volume", first}, MaxLength, "claim-a")

		assert.NotEqual(t, first, second)
		assert.Regexp(t, regexp.MustCompile("^redis-volume-[a-z0-9]{4}$"), second)
	})

	t.Run("stays within the limit", func(t *testing.T) {
		long := strings.Repeat("a", MaxLength)
		assert.Equal(t, MaxLength, utf8.RuneCountInString(UniqueSeeded(long, []string{long}, MaxLength, "claim-a")))
	})
}
