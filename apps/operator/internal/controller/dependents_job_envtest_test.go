package controller

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/go-logr/logr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/equality"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
)

func renderedMySQLJob(t *testing.T, s *runtime.Scheme, service *v1.Service) *batchv1.Job {
	objects, err := resourcebuilder.NewResourceBuilder(service, s, nil).BuildDatabaseObjects(context.Background(), logr.Discard(), "")
	require.NoError(t, err)
	for _, obj := range objects {
		if job, ok := obj.(*batchv1.Job); ok {
			return job
		}
	}
	t.Fatal("the mysql definition rendered no Job")
	return nil
}

// The real API server defaults the createdb Job: the rendered probe survives only
// when reconcileJob does not read those defaults as a change.
func TestReconcileJobAgainstAPIServer(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))

	testEnv := &envtest.Environment{
		CRDDirectoryPaths:     []string{filepath.Join("..", "..", "config", "crd", "bases")},
		ErrorIfCRDPathMissing: true,
		BinaryAssetsDirectory: getFirstFoundEnvTestBinaryDir(),
	}
	cfg, err := testEnv.Start()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, testEnv.Stop()) })

	c, err := client.New(cfg, client.Options{Scheme: s})
	require.NoError(t, err)
	r := &ServiceReconciler{Client: c, Scheme: s}

	require.NoError(t, c.Create(ctx, &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-ns"}}))
	service := &v1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "mysql-ld3k8m5lyopo", Namespace: "team-ns"},
		Spec: v1.ServiceSpec{
			Name:           "mysql-ld3k8m5lyopo",
			Type:           "database",
			TeamRef:        "team-id",
			ProjectRef:     "project-id",
			EnvironmentRef: "environment-id",
			ServiceRef:     "service-id",
			Config:         v1.ServiceConfigSpec{Database: v1.DatabaseSpec{Type: "mysql", DatabaseSpecVersion: "v0.1"}},
		},
	}
	require.NoError(t, c.Create(ctx, service))

	stored := func() *batchv1.Job {
		job := &batchv1.Job{}
		require.NoError(t, c.Get(ctx, client.ObjectKey{Namespace: "team-ns", Name: "mysql-ld3k8m5lyopo-createdb-moco"}, job))
		return job
	}

	first := renderedMySQLJob(t, s, service)
	second := renderedMySQLJob(t, s, service)
	require.Equal(t, renderHash(first.Spec), renderHash(second.Spec), "two renders of the same service must agree")

	require.NoError(t, r.reconcileJob(ctx, first, service))
	created := stored()

	renderedProbe := second.Spec.Template.Spec.Containers[0].ReadinessProbe
	storedProbe := created.Spec.Template.Spec.Containers[0].ReadinessProbe
	assert.Equal(t, int32(0), renderedProbe.SuccessThreshold)
	assert.Equal(t, int32(1), storedProbe.SuccessThreshold, "the API server defaults successThreshold")
	assert.False(t, equality.Semantic.DeepDerivative(second.Spec.Template.Spec.Containers, created.Spec.Template.Spec.Containers),
		"the container comparison the operator used before reads the server defaults as a change")

	require.NoError(t, r.reconcileJob(ctx, second, service))
	assert.Equal(t, created.UID, stored().UID, "an unchanged render must not recreate the Job")
}
