package controller

import (
	"context"
	"testing"

	mocov1beta2 "github.com/cybozu-go/moco/api/v1beta2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	batchv1 "k8s.io/api/batch/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestCleanupStaleBackupObjects(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))
	require.NoError(t, mocov1beta2.AddToScheme(s))

	controller := true
	service := &v1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "my-mysql", Namespace: "team-ns", UID: types.UID("svc-uid")},
	}
	ownedBy := func(uid string) []metav1.OwnerReference {
		return []metav1.OwnerReference{
			{APIVersion: "unbind.unbind.app/v1", Kind: "Service", Name: "owner", UID: types.UID(uid), Controller: &controller},
		}
	}
	cronJob := func(name string, owners []metav1.OwnerReference) *batchv1.CronJob {
		return &batchv1.CronJob{
			TypeMeta:   metav1.TypeMeta{APIVersion: "batch/v1", Kind: "CronJob"},
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "team-ns", OwnerReferences: owners},
		}
	}
	prune := cronJob("my-mysql-backup-prune", ownedBy("svc-uid"))
	kept := cronJob("my-mysql-createdb", ownedBy("svc-uid"))
	foreign := cronJob("other-backup", ownedBy("other-uid"))
	policy := &mocov1beta2.BackupPolicy{
		TypeMeta:   metav1.TypeMeta{APIVersion: "moco.cybozu.com/v1beta2", Kind: "BackupPolicy"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-mysql-backup", Namespace: "team-ns", OwnerReferences: ownedBy("svc-uid")},
	}

	exists := func(c client.Client, obj client.Object) bool {
		err := c.Get(ctx, client.ObjectKeyFromObject(obj), obj.DeepCopyObject().(client.Object))
		require.True(t, err == nil || kerrors.IsNotFound(err))
		return err == nil
	}

	t.Run("deletes owned backup objects missing from the rendered set", func(t *testing.T) {
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, prune, kept, foreign, policy).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}

		require.NoError(t, r.cleanupStaleBackupObjects(ctx, service, []runtime.Object{kept}))

		assert.False(t, exists(c, prune), "prune cronjob should be deleted")
		assert.False(t, exists(c, policy), "backup policy should be deleted")
		assert.True(t, exists(c, kept), "rendered cronjob should stay")
		assert.True(t, exists(c, foreign), "cronjob owned by another service should stay")
	})

	t.Run("keeps everything that is still rendered", func(t *testing.T) {
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, prune, policy).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}

		require.NoError(t, r.cleanupStaleBackupObjects(ctx, service, []runtime.Object{prune, policy}))

		assert.True(t, exists(c, prune))
		assert.True(t, exists(c, policy))
	})
}
