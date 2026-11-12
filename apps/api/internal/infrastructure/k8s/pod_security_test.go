package k8s

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestEnsurePrivilegedNamespace(t *testing.T) {
	tests := []struct {
		name   string
		labels map[string]string
		want   map[string]string
	}{
		{
			name:   "unlabeled gets privileged",
			labels: map[string]string{"kubernetes.io/metadata.name": "unbind-system"},
			want:   map[string]string{"kubernetes.io/metadata.name": "unbind-system", PodSecurityEnforceLabel: "privileged"},
		},
		{
			name:   "a level set by hand is kept",
			labels: map[string]string{PodSecurityEnforceLabel: "baseline"},
			want:   map[string]string{PodSecurityEnforceLabel: "baseline"},
		},
		{
			name:   "no labels at all",
			labels: nil,
			want:   map[string]string{PodSecurityEnforceLabel: "privileged"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.NewClientset(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "unbind-system", Labels: tt.labels}})

			require.NoError(t, EnsurePrivilegedNamespace(context.Background(), client, "unbind-system"))

			namespace, err := client.CoreV1().Namespaces().Get(context.Background(), "unbind-system", metav1.GetOptions{})
			require.NoError(t, err)
			assert.Equal(t, tt.want, namespace.Labels)
		})
	}
}

func TestEnsurePrivilegedNamespaceMissing(t *testing.T) {
	assert.Error(t, EnsurePrivilegedNamespace(context.Background(), fake.NewClientset(), "unbind-system"))
}
