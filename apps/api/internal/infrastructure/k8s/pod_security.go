package k8s

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

const PodSecurityEnforceLabel = "pod-security.kubernetes.io/enforce"

// EnsurePrivilegedNamespace lets the system namespace run buildkit, alloy and node-exporter
// on clusters that enforce a stricter Pod Security level by default. A level already set is kept.
func EnsurePrivilegedNamespace(ctx context.Context, client kubernetes.Interface, name string) error {
	namespace, err := client.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get namespace %s: %w", name, err)
	}
	if _, ok := namespace.Labels[PodSecurityEnforceLabel]; ok {
		return nil
	}

	patch := fmt.Appendf(nil, `{"metadata":{"labels":{%q:"privileged"}}}`, PodSecurityEnforceLabel)
	if _, err := client.CoreV1().Namespaces().Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{}); err != nil {
		return fmt.Errorf("failed to label namespace %s: %w", name, err)
	}
	return nil
}
