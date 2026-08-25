package controller

import (
	"context"
	"testing"

	altinityv1 "github.com/altinity/clickhouse-operator/pkg/apis/clickhouse.altinity.com/v1"
	mocov1beta2 "github.com/cybozu-go/moco/api/v1beta2"
	"github.com/go-logr/logr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	postgresv1 "github.com/zalando/postgres-operator/pkg/apis/acid.zalan.do/v1"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"
)

type watchRecorder struct {
	watched []source.TypedSource[reconcile.Request]
}

func (w *watchRecorder) Reconcile(ctx context.Context, req reconcile.Request) (ctrl.Result, error) {
	return ctrl.Result{}, nil
}

func (w *watchRecorder) Watch(src source.TypedSource[reconcile.Request]) error {
	w.watched = append(w.watched, src)
	return nil
}

func (w *watchRecorder) Start(ctx context.Context) error { return nil }

func (w *watchRecorder) GetLogger() logr.Logger { return logr.Discard() }

func databaseService(dbType string) *v1.Service {
	return &v1.Service{
		Spec: v1.ServiceSpec{
			Type: "database",
			Config: v1.ServiceConfigSpec{
				Database: v1.DatabaseSpec{Type: dbType},
			},
		},
	}
}

func watchScheme(t *testing.T) *runtime.Scheme {
	s := runtime.NewScheme()
	require.NoError(t, v1.AddToScheme(s))
	require.NoError(t, postgresv1.AddToScheme(s))
	require.NoError(t, mocov1beta2.AddToScheme(s))
	require.NoError(t, altinityv1.AddToScheme(s))
	return s
}

func watchReconciler(t *testing.T, mappedGVKs ...schema.GroupVersionKind) (*ServiceReconciler, *watchRecorder) {
	mapper := apimeta.NewDefaultRESTMapper(nil)
	for _, gvk := range mappedGVKs {
		mapper.Add(gvk, apimeta.RESTScopeNamespace)
	}
	recorder := &watchRecorder{}
	return &ServiceReconciler{
		Scheme:      watchScheme(t),
		controller:  recorder,
		restMapper:  mapper,
		watchedGVKs: map[schema.GroupVersionKind]bool{},
	}, recorder
}

func TestEnsureDatabaseWatch(t *testing.T) {
	// zalando registers the lowercase kind "postgresql", so derive it from the scheme
	postgresGVK, err := apiutil.GVKForObject(&postgresv1.Postgresql{}, watchScheme(t))
	require.NoError(t, err)

	t.Run("chart-backed database registers nothing", func(t *testing.T) {
		r, recorder := watchReconciler(t)
		result, err := r.ensureDatabaseWatch(databaseService("redis"))
		require.NoError(t, err)
		assert.Zero(t, result)
		assert.Empty(t, recorder.watched)
	})

	t.Run("nil controller is a no-op", func(t *testing.T) {
		r := &ServiceReconciler{Scheme: watchScheme(t)}
		result, err := r.ensureDatabaseWatch(databaseService("postgres"))
		require.NoError(t, err)
		assert.Zero(t, result)
	})

	t.Run("missing CRD requeues without watching", func(t *testing.T) {
		r, recorder := watchReconciler(t)
		result, err := r.ensureDatabaseWatch(databaseService("postgres"))
		require.NoError(t, err)
		assert.Equal(t, missingCRDRequeueInterval, result.RequeueAfter)
		assert.Empty(t, recorder.watched)
	})

	t.Run("present CRD registers the watch once", func(t *testing.T) {
		r, recorder := watchReconciler(t, postgresGVK)

		result, err := r.ensureDatabaseWatch(databaseService("postgres"))
		require.NoError(t, err)
		assert.Zero(t, result)
		assert.Len(t, recorder.watched, 1)

		result, err = r.ensureDatabaseWatch(databaseService("postgres"))
		require.NoError(t, err)
		assert.Zero(t, result)
		assert.Len(t, recorder.watched, 1)
	})
}
