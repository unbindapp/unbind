package k8s

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	authorizationv1 "k8s.io/api/authorization/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
)

func TestAuthorizePodExec_Allowed(t *testing.T) {
	client := k8sfake.NewClientset()
	var submitted *authorizationv1.SubjectAccessReview
	client.PrependReactor("create", "subjectaccessreviews", func(action clienttesting.Action) (bool, runtime.Object, error) {
		submitted = action.(clienttesting.CreateAction).GetObject().(*authorizationv1.SubjectAccessReview)
		result := submitted.DeepCopy()
		result.Status.Allowed = true
		return true, result, nil
	})
	kubeClient := &KubeClient{clientset: client}

	err := kubeClient.authorizePodExec(context.Background(), "user@example.com", []string{"oidc:users", "oidc:team-editors"}, "team-ns", "web-0")
	require.NoError(t, err)

	require.NotNil(t, submitted)
	assert.Equal(t, "user@example.com", submitted.Spec.User)
	assert.Equal(t, []string{"oidc:users", "oidc:team-editors"}, submitted.Spec.Groups)
	attrs := submitted.Spec.ResourceAttributes
	require.NotNil(t, attrs)
	assert.Equal(t, "team-ns", attrs.Namespace)
	assert.Equal(t, "create", attrs.Verb)
	assert.Equal(t, "pods", attrs.Resource)
	assert.Equal(t, "exec", attrs.Subresource)
	assert.Equal(t, "web-0", attrs.Name)
}

func TestAuthorizePodExec_Denied(t *testing.T) {
	client := k8sfake.NewClientset()
	client.PrependReactor("create", "subjectaccessreviews", func(action clienttesting.Action) (bool, runtime.Object, error) {
		result := action.(clienttesting.CreateAction).GetObject().(*authorizationv1.SubjectAccessReview).DeepCopy()
		result.Status.Allowed = false
		return true, result, nil
	})
	kubeClient := &KubeClient{clientset: client}

	err := kubeClient.authorizePodExec(context.Background(), "user@example.com", []string{"oidc:users"}, "team-ns", "web-0")

	assert.ErrorIs(t, err, errdefs.ErrUnauthorized)
}

func TestAuthorizePodExec_ReviewError(t *testing.T) {
	client := k8sfake.NewClientset()
	client.PrependReactor("create", "subjectaccessreviews", func(action clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("api server unavailable")
	})
	kubeClient := &KubeClient{clientset: client}

	err := kubeClient.authorizePodExec(context.Background(), "user@example.com", nil, "team-ns", "web-0")

	assert.ErrorContains(t, err, "failed to check exec authorization")
}
