package gitenv

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	corev1 "k8s.io/api/core/v1"
)

func TestVars(t *testing.T) {
	sha := "0123456789abcdef0123456789abcdef01234567"
	tests := []struct {
		name      string
		commitSHA string
		ref       string
		want      map[string]string
	}{
		{"bare branch", sha, "main", map[string]string{KeySHA: sha, KeyBranch: "main"}},
		{"branch ref", sha, "refs/heads/feature/x", map[string]string{KeySHA: sha, KeyBranch: "feature/x"}},
		{"tag ref has no branch", sha, "refs/tags/v1.2.0", map[string]string{KeySHA: sha}},
		{"unknown commit", "", "refs/heads/main", map[string]string{KeyBranch: "main"}},
		{"nothing known", "", "", map[string]string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, Vars(tt.commitSHA, tt.ref))
		})
	}
}

func TestDeploymentVars(t *testing.T) {
	assert.Equal(t, map[string]string{KeySHA: "abc", KeyBranch: "main"},
		DeploymentVars(&ent.Deployment{CommitSha: new("abc"), GitBranch: new("refs/heads/main")}))
	assert.Empty(t, DeploymentVars(&ent.Deployment{}))
}

func TestAppendReplacesSameName(t *testing.T) {
	rendered := []corev1.EnvVar{
		{Name: "API_URL", Value: "http://api"},
		{Name: KeySHA, Value: "stale"},
	}

	got := Append(rendered, map[string]string{KeySHA: "abc", KeyBranch: "main"})

	assert.Equal(t, []corev1.EnvVar{
		{Name: "API_URL", Value: "http://api"},
		{Name: KeyBranch, Value: "main"},
		{Name: KeySHA, Value: "abc"},
	}, got)
	assert.Equal(t, "stale", rendered[1].Value)
}
