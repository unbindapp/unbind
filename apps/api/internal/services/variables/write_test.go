package variables_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
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
