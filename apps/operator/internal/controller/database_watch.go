package controller

import (
	"time"

	altinityv1 "github.com/altinity/clickhouse-operator/pkg/apis/clickhouse.altinity.com/v1"
	mocov1beta2 "github.com/cybozu-go/moco/api/v1beta2"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	postgresv1 "github.com/zalando/postgres-operator/pkg/apis/acid.zalan.do/v1"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/source"
)

const missingCRDRequeueInterval = 30 * time.Second

// nil means chart-backed: status flows through the always-watched HelmRelease
func databaseWatchObject(dbType string) client.Object {
	switch dbType {
	case "postgres":
		return &postgresv1.Postgresql{}
	case "mysql":
		return &mocov1beta2.MySQLCluster{}
	case "clickhouse":
		return &altinityv1.ClickHouseInstallation{}
	default:
		return nil
	}
}

// DB operator CRDs are installed on demand, so the owner watch is registered on the
// first reconcile after the CRD appears; until then requeue to poll.
func (r *ServiceReconciler) ensureDatabaseWatch(service *v1.Service) (ctrl.Result, error) {
	obj := databaseWatchObject(service.Spec.Config.Database.Type)
	if obj == nil || r.controller == nil {
		return ctrl.Result{}, nil
	}

	gvk, err := apiutil.GVKForObject(obj, r.Scheme)
	if err != nil {
		return ctrl.Result{}, err
	}

	r.watchedMu.Lock()
	defer r.watchedMu.Unlock()
	if r.watchedGVKs[gvk] {
		return ctrl.Result{}, nil
	}

	if _, err := r.restMapper.RESTMapping(gvk.GroupKind(), gvk.Version); err != nil {
		if apimeta.IsNoMatchError(err) {
			return ctrl.Result{RequeueAfter: missingCRDRequeueInterval}, nil
		}
		return ctrl.Result{}, err
	}

	ownerHandler := handler.EnqueueRequestForOwner(r.Scheme, r.restMapper, &v1.Service{}, handler.OnlyControllerOwner())
	if err := r.controller.Watch(source.Kind(r.cache, obj, ownerHandler)); err != nil {
		return ctrl.Result{}, err
	}
	r.watchedGVKs[gvk] = true
	return ctrl.Result{}, nil
}
