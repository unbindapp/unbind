package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestReconcileCronJob(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))

	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "report", Namespace: "team", UID: types.UID("svc-uid")}}
	service.Spec.Config.Image = "report:1"
	service.Spec.Config.CronSchedule = "0 * * * *"
	runningDeployment := &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "report", Namespace: "team"}}

	c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, runningDeployment).Build()
	r := &ServiceReconciler{Client: c, Scheme: s}
	key := client.ObjectKey{Namespace: "team", Name: "report"}

	require.NoError(t, r.reconcileCronJob(ctx, resourcebuilder.NewResourceBuilder(service, s, nil), *service))

	cronJob := &batchv1.CronJob{}
	require.NoError(t, c.Get(ctx, key, cronJob))
	assert.Equal(t, "0 * * * *", cronJob.Spec.Schedule)
	assert.True(t, metav1.IsControlledBy(cronJob, service), "the runs go when the service goes")
	assert.True(t, kerrors.IsNotFound(c.Get(ctx, key, &appsv1.Deployment{})), "the continuous workload is retired")

	service.Spec.Config.CronSchedule = "*/5 * * * *"
	require.NoError(t, r.reconcileCronJob(ctx, resourcebuilder.NewResourceBuilder(service, s, nil), *service))
	require.NoError(t, c.Get(ctx, key, cronJob))
	assert.Equal(t, "*/5 * * * *", cronJob.Spec.Schedule, "a schedule change updates in place")

	service.Spec.Config.CronSchedule = ""
	require.NoError(t, r.reconcileCronJob(ctx, resourcebuilder.NewResourceBuilder(service, s, nil), *service))
	assert.True(t, kerrors.IsNotFound(c.Get(ctx, key, &batchv1.CronJob{})), "no schedule, no cron job")
}
