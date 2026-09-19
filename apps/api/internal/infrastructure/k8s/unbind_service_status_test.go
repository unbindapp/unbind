package k8s

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestUnbindServiceState(t *testing.T) {
	t.Run("reads the generation and the conditions", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "app", "generation": int64(6)},
			"status": map[string]any{
				"deploymentStatus": "Failed",
				"conditions": []any{map[string]any{
					"type":               unbindv1.ConditionTypeReconciled,
					"status":             "False",
					"reason":             unbindv1.ReconcileReasonFailed,
					"message":            "volume name too long",
					"observedGeneration": int64(6),
				}},
			},
		}}

		state, err := unbindServiceState(obj)
		require.NoError(t, err)
		assert.Equal(t, int64(6), state.Generation)
		require.Len(t, state.Status.Conditions, 1)
		assert.Equal(t, "volume name too long", state.Status.Conditions[0].Message)
		assert.Equal(t, int64(6), state.Status.Conditions[0].ObservedGeneration)
	})

	t.Run("a CR without a status has no conditions", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "app", "generation": int64(1)},
		}}

		state, err := unbindServiceState(obj)
		require.NoError(t, err)
		assert.Equal(t, int64(1), state.Generation)
		assert.Empty(t, state.Status.Conditions)
	})
}
