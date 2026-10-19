// Package gitenv names the commit a service was built from, for its build and its pods.
package gitenv

import (
	"maps"
	"slices"
	"strings"

	"github.com/unbindapp/unbind-api/ent"
	corev1 "k8s.io/api/core/v1"
)

const (
	KeySHA    = "UNBIND_GIT_SHA"
	KeyBranch = "UNBIND_GIT_BRANCH"
)

func IsKey(key string) bool {
	return key == KeySHA || key == KeyBranch
}

// Branch returns the branch of a bare branch name or a full ref, and nothing for a tag
func Branch(ref string) string {
	if strings.HasPrefix(ref, "refs/tags/") {
		return ""
	}
	return strings.TrimPrefix(ref, "refs/heads/")
}

func Vars(commitSHA, ref string) map[string]string {
	vars := map[string]string{}
	if commitSHA != "" {
		vars[KeySHA] = commitSHA
	}
	if branch := Branch(ref); branch != "" {
		vars[KeyBranch] = branch
	}
	return vars
}

func DeploymentVars(deployment *ent.Deployment) map[string]string {
	var commitSHA, ref string
	if deployment.CommitSha != nil {
		commitSHA = *deployment.CommitSha
	}
	if deployment.GitBranch != nil {
		ref = *deployment.GitBranch
	}
	return Vars(commitSHA, ref)
}

// Append adds vars to envVars, replacing entries of the same name
func Append(envVars []corev1.EnvVar, vars map[string]string) []corev1.EnvVar {
	merged := slices.DeleteFunc(slices.Clone(envVars), func(env corev1.EnvVar) bool {
		_, replaced := vars[env.Name]
		return replaced
	})
	for _, name := range slices.Sorted(maps.Keys(vars)) {
		merged = append(merged, corev1.EnvVar{Name: name, Value: vars[name]})
	}
	return merged
}
