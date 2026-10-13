package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func renderedCreatedbJob(script string) *batchv1.Job {
	return &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "my-mysql-createdb-moco", Namespace: "team-ns"},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{{
						Name:    "mysql-client",
						Image:   "mysql:8.4",
						Command: []string{"sh", "-c"},
						Args:    []string{script},
						ReadinessProbe: &corev1.Probe{
							ProbeHandler:        corev1.ProbeHandler{Exec: &corev1.ExecAction{Command: []string{"pgrep", "mysql"}}},
							InitialDelaySeconds: 5,
							PeriodSeconds:       10,
							TimeoutSeconds:      5,
							FailureThreshold:    3,
						},
					}},
				},
			},
		},
	}
}

func applyAPIServerDefaults(job *batchv1.Job) {
	container := &job.Spec.Template.Spec.Containers[0]
	container.ImagePullPolicy = corev1.PullIfNotPresent
	container.TerminationMessagePath = "/dev/termination-log"
	container.TerminationMessagePolicy = corev1.TerminationMessageReadFile
	container.ReadinessProbe.SuccessThreshold = 1
}

func TestReconcileJob(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))

	owner := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "my-mysql", Namespace: "team-ns", UID: types.UID("svc-uid")}}

	storedJob := func(c client.Client) *batchv1.Job {
		job := &batchv1.Job{}
		require.NoError(t, c.Get(ctx, client.ObjectKey{Namespace: "team-ns", Name: "my-mysql-createdb-moco"}, job))
		return job
	}

	createDefaulted := func(c client.Client, r *ServiceReconciler, script string) *batchv1.Job {
		require.NoError(t, r.reconcileJob(ctx, renderedCreatedbJob(script), owner))
		job := storedJob(c)
		applyAPIServerDefaults(job)
		require.NoError(t, c.Update(ctx, job))
		return storedJob(c)
	}

	t.Run("a running job whose render has not changed is left alone", func(t *testing.T) {
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(owner).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}
		before := createDefaulted(c, r, "create db")

		require.NoError(t, r.reconcileJob(ctx, renderedCreatedbJob("create db"), owner))

		after := storedJob(c)
		assert.Equal(t, before.ResourceVersion, after.ResourceVersion)
		assert.Equal(t, int32(1), after.Spec.Template.Spec.Containers[0].ReadinessProbe.SuccessThreshold, "the server defaulted job must survive")
	})

	t.Run("a running job is recreated when the render changes", func(t *testing.T) {
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(owner).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}
		createDefaulted(c, r, "create db")

		require.NoError(t, r.reconcileJob(ctx, renderedCreatedbJob("create other db"), owner))

		after := storedJob(c)
		assert.Equal(t, []string{"create other db"}, after.Spec.Template.Spec.Containers[0].Args)
		assert.Equal(t, renderHash(renderedCreatedbJob("create other db").Spec), after.Annotations[renderHashAnnotation])
	})

	t.Run("a finished job is left alone even when the render changed", func(t *testing.T) {
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(owner).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}
		job := createDefaulted(c, r, "create db")
		job.Status.Conditions = []batchv1.JobCondition{{Type: batchv1.JobComplete, Status: corev1.ConditionTrue}}
		require.NoError(t, c.Status().Update(ctx, job))

		require.NoError(t, r.reconcileJob(ctx, renderedCreatedbJob("create other db"), owner))

		assert.Equal(t, []string{"create db"}, storedJob(c).Spec.Template.Spec.Containers[0].Args)
	})
}
