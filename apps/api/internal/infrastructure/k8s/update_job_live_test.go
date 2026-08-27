//go:build live

package k8s

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	rbacv1 "k8s.io/api/rbac/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func newLiveKubeClient(t *testing.T) *KubeClient {
	t.Helper()
	kubeconfig := os.Getenv("LIVE_KUBECONFIG")
	if kubeconfig == "" {
		t.Skip("LIVE_KUBECONFIG not set")
	}
	cfg := &config.Config{
		KubeConfig:            kubeconfig,
		SystemNamespace:       "unbind-system",
		UpdaterServiceAccount: "unbind-updater-sa",
	}
	client := NewKubeClient(cfg, nil)
	client.updateJobPollInterval = time.Second
	return client
}

func TestLiveRunManifestApplyJob_Success(t *testing.T) {
	client := newLiveKubeClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	manifests := []byte(`
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: verify-job-applied
rules:
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "update", "patch"]
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: verify-job-applied
data:
  key: value
`)

	err := client.RunManifestApplyJob(ctx, "v9.9.9-test", os.Getenv("LIVE_JOB_IMAGE"), manifests)
	require.NoError(t, err)

	clientset := client.GetInternalClient()
	_, err = clientset.RbacV1().ClusterRoles().Get(ctx, "verify-job-applied", metav1.GetOptions{})
	assert.NoError(t, err)
	_, err = clientset.CoreV1().ConfigMaps("unbind-system").Get(ctx, "verify-job-applied", metav1.GetOptions{})
	assert.NoError(t, err)

	_, err = clientset.BatchV1().Jobs("unbind-system").Get(ctx, "unbind-update-apply-v9-9-9-test", metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(err), "job should be cleaned up, got: %v", err)
	_, err = clientset.CoreV1().ConfigMaps("unbind-system").Get(ctx, "unbind-update-apply-v9-9-9-test", metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(err), "manifests configmap should be cleaned up, got: %v", err)
}

func TestLiveAuthorizePodExec(t *testing.T) {
	client := newLiveKubeClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	clientset := client.GetInternalClient()

	err := client.authorizePodExec(ctx, "user@example.com", []string{"oidc:users"}, "unbind-system", "some-pod")
	assert.ErrorIs(t, err, errdefs.ErrUnauthorized)

	role := &rbacv1.Role{
		ObjectMeta: metav1.ObjectMeta{Name: "verify-exec-role", Namespace: "unbind-system"},
		Rules: []rbacv1.PolicyRule{
			{APIGroups: []string{""}, Resources: []string{"pods/exec"}, Verbs: []string{"create"}},
		},
	}
	binding := &rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: "verify-exec-binding", Namespace: "unbind-system"},
		Subjects:   []rbacv1.Subject{{Kind: "Group", APIGroup: "rbac.authorization.k8s.io", Name: "oidc:test-editors"}},
		RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "Role", Name: "verify-exec-role"},
	}
	_, err = clientset.RbacV1().Roles("unbind-system").Create(ctx, role, metav1.CreateOptions{})
	require.NoError(t, err)
	_, err = clientset.RbacV1().RoleBindings("unbind-system").Create(ctx, binding, metav1.CreateOptions{})
	require.NoError(t, err)
	defer func() {
		_ = clientset.RbacV1().RoleBindings("unbind-system").Delete(context.Background(), "verify-exec-binding", metav1.DeleteOptions{})
		_ = clientset.RbacV1().Roles("unbind-system").Delete(context.Background(), "verify-exec-role", metav1.DeleteOptions{})
	}()

	err = client.authorizePodExec(ctx, "user@example.com", []string{"oidc:test-editors"}, "unbind-system", "some-pod")
	assert.NoError(t, err)

	err = client.authorizePodExec(ctx, "user@example.com", []string{"oidc:test-editors"}, "kube-system", "some-pod")
	assert.ErrorIs(t, err, errdefs.ErrUnauthorized)
}

func TestLiveRunManifestApplyJob_FailureSurfacesApplierError(t *testing.T) {
	client := newLiveKubeClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	manifests := []byte(`
apiVersion: v1
kind: ConfigMap
metadata:
  name: verify-job-invalid
data: 42
`)

	err := client.RunManifestApplyJob(ctx, "v9.9.8-test", os.Getenv("LIVE_JOB_IMAGE"), manifests)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "expected map")

	clientset := client.GetInternalClient()
	_, getErr := clientset.BatchV1().Jobs("unbind-system").Get(ctx, "unbind-update-apply-v9-9-8-test", metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(getErr), "failed job should be cleaned up, got: %v", getErr)
}
