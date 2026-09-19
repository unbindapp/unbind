package controller

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestUpdateServiceStatusReportsReconcileFailure(t *testing.T) {
	ctx := context.Background()
	s := remediationScheme(t)
	service := &v1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "app", Namespace: "team", Generation: 4},
		Spec:       v1.ServiceSpec{Type: "docker-image"},
	}
	c := fake.NewClientBuilder().WithScheme(s).WithObjects(service).WithStatusSubresource(service).Build()
	r := &ServiceReconciler{Client: c, Scheme: s}

	stored := func() *v1.Service {
		current := &v1.Service{}
		require.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(service), current))
		return current
	}

	require.NoError(t, r.updateServiceStatus(ctx, stored(), errors.New("volume name must be no more than 63 characters")))
	failed := stored()
	condition := apimeta.FindStatusCondition(failed.Status.Conditions, v1.ConditionTypeReconciled)
	require.NotNil(t, condition)
	assert.Equal(t, metav1.ConditionFalse, condition.Status)
	assert.Equal(t, v1.ReconcileReasonFailed, condition.Reason)
	assert.Equal(t, "volume name must be no more than 63 characters", condition.Message)
	assert.Equal(t, int64(4), condition.ObservedGeneration)
	assert.Equal(t, v1.DeploymentStatusFailed, failed.Status.DeploymentStatus)

	require.NoError(t, r.updateServiceStatus(ctx, stored(), nil))
	recovered := stored()
	condition = apimeta.FindStatusCondition(recovered.Status.Conditions, v1.ConditionTypeReconciled)
	require.NotNil(t, condition)
	assert.Equal(t, metav1.ConditionTrue, condition.Status)
	assert.Equal(t, "Ready", recovered.Status.DeploymentStatus)
}
