package k8s

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	mocks_config "github.com/unbindapp/unbind-api/mocks/config"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
)

func testRoute(name, host string, timeouts ...string) *unstructured.Unstructured {
	rules := []any{}
	for _, timeout := range timeouts {
		rule := map[string]any{"backendRefs": []any{map[string]any{"name": "unbind-api", "port": int64(80)}}}
		if timeout != "" {
			rule["timeouts"] = map[string]any{"request": timeout}
		}
		rules = append(rules, rule)
	}
	route := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{"hostnames": []any{host}, "rules": rules},
	}}
	route.SetAPIVersion("gateway.networking.k8s.io/v1")
	route.SetKind("HTTPRoute")
	route.SetName(name)
	route.SetNamespace(testNamespace)
	return route
}

func requestTimeouts(t *testing.T, route *unstructured.Unstructured) []string {
	t.Helper()
	rules, _, err := unstructured.NestedSlice(route.Object, "spec", "rules")
	require.NoError(t, err)
	timeouts := []string{}
	for _, rule := range rules {
		timeout, _, _ := unstructured.NestedString(rule.(map[string]any), "timeouts", "request")
		timeouts = append(timeouts, timeout)
	}
	return timeouts
}

func TestSetMissingRequestTimeouts(t *testing.T) {
	route := testRoute("unbind-api-route", "unbind.example.com", "", "60s", "")
	assert.True(t, setMissingRequestTimeouts(route))
	assert.Equal(t, []string{"21600s", "60s", "21600s"}, requestTimeouts(t, route))

	assert.False(t, setMissingRequestTimeouts(route))
}

func TestEnsurePlatformRouteTimeouts(t *testing.T) {
	platform := testRoute("unbind-api-route", "unbind.example.com", "", "")
	solver := testRoute("cm-acme-http-solver", "app.example.com", "")
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{httpRouteGVR: "HTTPRouteList"}, platform, solver)
	mockConfig := &mocks_config.ConfigMock{}
	mockConfig.On("GetSystemNamespace").Return(testNamespace)
	client := &KubeClient{client: dyn, config: mockConfig}

	require.NoError(t, client.EnsurePlatformRouteTimeouts(context.Background(), "https://unbind.example.com"))

	updated, err := dyn.Resource(httpRouteGVR).Namespace(testNamespace).Get(context.Background(), "unbind-api-route", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, []string{"21600s", "21600s"}, requestTimeouts(t, updated))

	untouched, err := dyn.Resource(httpRouteGVR).Namespace(testNamespace).Get(context.Background(), "cm-acme-http-solver", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, []string{""}, requestTimeouts(t, untouched))
}
