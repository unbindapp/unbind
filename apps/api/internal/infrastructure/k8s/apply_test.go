package k8s

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	fakediscovery "k8s.io/client-go/discovery/fake"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
)

var (
	configMapGVR   = schema.GroupVersionResource{Version: "v1", Resource: "configmaps"}
	clusterRoleGVR = schema.GroupVersionResource{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterroles"}
)

func newTestApplier(t *testing.T) (*Applier, *dynamicfake.FakeDynamicClient) {
	t.Helper()

	disc := k8sfake.NewClientset().Discovery().(*fakediscovery.FakeDiscovery)
	disc.Resources = []*metav1.APIResourceList{
		{
			GroupVersion: "v1",
			APIResources: []metav1.APIResource{
				{Name: "configmaps", Kind: "ConfigMap", Namespaced: true},
			},
		},
		{
			GroupVersion: "rbac.authorization.k8s.io/v1",
			APIResources: []metav1.APIResource{
				{Name: "clusterroles", Kind: "ClusterRole", Namespaced: false},
			},
		},
	}

	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		configMapGVR:   "ConfigMapList",
		clusterRoleGVR: "ClusterRoleList",
	})
	// The v0.36 fake tracker cannot create-on-apply; answer apply patches directly.
	dyn.PrependReactor("patch", "*", func(action clienttesting.Action) (bool, runtime.Object, error) {
		patch, ok := action.(clienttesting.PatchActionImpl)
		if !ok || patch.PatchType != types.ApplyPatchType {
			return false, nil, nil
		}
		obj := &unstructured.Unstructured{}
		if err := json.Unmarshal(patch.Patch, &obj.Object); err != nil {
			return true, nil, err
		}
		return true, obj, nil
	})

	return NewApplier(dyn, disc, "unbind-system"), dyn
}

func patchActions(dyn *dynamicfake.FakeDynamicClient) []clienttesting.PatchActionImpl {
	var patches []clienttesting.PatchActionImpl
	for _, action := range dyn.Actions() {
		if patch, ok := action.(clienttesting.PatchActionImpl); ok {
			patches = append(patches, patch)
		}
	}
	return patches
}

func TestApplier_DryRunThenApply(t *testing.T) {
	applier, dyn := newTestApplier(t)

	manifests := []byte(`
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
data:
  key: value
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: test-role
rules:
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "update", "patch"]
`)

	require.NoError(t, applier.Apply(context.Background(), manifests))

	patches := patchActions(dyn)
	require.Len(t, patches, 4)

	for i, patch := range patches {
		assert.Equal(t, "unbind-updater", patch.PatchOptions.FieldManager)
		if i < 2 {
			assert.Equal(t, []string{metav1.DryRunAll}, patch.PatchOptions.DryRun)
		} else {
			assert.Empty(t, patch.PatchOptions.DryRun)
		}
	}

	for _, i := range []int{0, 2} {
		assert.Equal(t, configMapGVR, patches[i].GetResource())
		assert.Equal(t, "test-config", patches[i].Name)
		assert.Equal(t, "unbind-system", patches[i].GetNamespace())
	}
	for _, i := range []int{1, 3} {
		assert.Equal(t, clusterRoleGVR, patches[i].GetResource())
		assert.Equal(t, "test-role", patches[i].Name)
		assert.Empty(t, patches[i].GetNamespace())
	}
}

func TestApplier_ExplicitNamespacePreserved(t *testing.T) {
	applier, dyn := newTestApplier(t)

	manifests := []byte(`
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
  namespace: other-namespace
`)

	require.NoError(t, applier.Apply(context.Background(), manifests))

	patches := patchActions(dyn)
	require.Len(t, patches, 2)
	assert.Equal(t, "other-namespace", patches[0].GetNamespace())
}

func TestApplier_SeparatorInsideStringValue(t *testing.T) {
	applier, dyn := newTestApplier(t)

	manifests := []byte(`
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
data:
  doc: |
    ---
    nested: document
`)

	require.NoError(t, applier.Apply(context.Background(), manifests))

	patches := patchActions(dyn)
	require.Len(t, patches, 2)
	assert.Equal(t, "test-config", patches[0].Name)
}

func TestApplier_EmptyInput(t *testing.T) {
	applier, dyn := newTestApplier(t)

	require.NoError(t, applier.Apply(context.Background(), []byte("---\n\n---\n")))
	assert.Empty(t, patchActions(dyn))
}

func TestApplier_InvalidYAML(t *testing.T) {
	applier, _ := newTestApplier(t)

	err := applier.Apply(context.Background(), []byte("invalid: yaml: content: [\ninvalid"))
	assert.ErrorContains(t, err, "failed to decode manifest")
}

func TestApplier_MissingName(t *testing.T) {
	applier, _ := newTestApplier(t)

	err := applier.Apply(context.Background(), []byte("apiVersion: v1\nkind: ConfigMap\n"))
	assert.ErrorContains(t, err, "missing kind or name")
}

func TestApplier_UnknownKindSkippedInDryRunFailsOnApply(t *testing.T) {
	applier, dyn := newTestApplier(t)

	manifests := []byte(`
apiVersion: example.com/v1
kind: Widget
metadata:
  name: test-widget
`)

	err := applier.Apply(context.Background(), manifests)
	assert.ErrorContains(t, err, "Widget")
	assert.Empty(t, patchActions(dyn))
}
