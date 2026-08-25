package controller

import (
	"context"
	"fmt"

	altinityv1 "github.com/altinity/clickhouse-operator/pkg/apis/clickhouse.altinity.com/v1"
	mocov1beta2 "github.com/cybozu-go/moco/api/v1beta2"
	helmv2 "github.com/fluxcd/helm-controller/api/v2"
	fluxmeta "github.com/fluxcd/pkg/apis/meta"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	postgresv1 "github.com/zalando/postgres-operator/pkg/apis/acid.zalan.do/v1"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func databaseCondition(status metav1.ConditionStatus, reason, message string) metav1.Condition {
	return metav1.Condition{
		Type:    v1.ConditionTypeDatabaseReady,
		Status:  status,
		Reason:  reason,
		Message: message,
	}
}

func databaseNotCreatedCondition() metav1.Condition {
	return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonProgressing, "Database resources not yet created")
}

func databaseListErrorCondition(err error) metav1.Condition {
	return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonProgressing, fmt.Sprintf("Unable to read database status: %v", err))
}

func (r *ServiceReconciler) computeDatabaseCondition(ctx context.Context, service *v1.Service) metav1.Condition {
	switch service.Spec.Config.Database.Type {
	case "postgres":
		return r.postgresCondition(ctx, service)
	case "mysql":
		return r.mysqlCondition(ctx, service)
	case "clickhouse":
		return r.clickhouseCondition(ctx, service)
	default:
		// redis, mongodb, and any future chart-backed database
		return r.helmReleaseCondition(ctx, service)
	}
}

func (r *ServiceReconciler) ownedHelmRelease(ctx context.Context, service *v1.Service) (*helmv2.HelmRelease, error) {
	var list helmv2.HelmReleaseList
	if err := r.List(ctx, &list, client.InNamespace(service.Namespace)); err != nil {
		return nil, err
	}
	for i := range list.Items {
		if metav1.IsControlledBy(&list.Items[i], service) {
			return &list.Items[i], nil
		}
	}
	return nil, nil
}

func (r *ServiceReconciler) helmReleaseCondition(ctx context.Context, service *v1.Service) metav1.Condition {
	release, err := r.ownedHelmRelease(ctx, service)
	if err != nil {
		return databaseListErrorCondition(err)
	}
	if release == nil {
		return databaseNotCreatedCondition()
	}
	return helmReleaseStatusCondition(release)
}

func helmReleaseStatusCondition(release *helmv2.HelmRelease) metav1.Condition {
	if stalled := apimeta.FindStatusCondition(release.Status.Conditions, fluxmeta.StalledCondition); stalled != nil && stalled.Status == metav1.ConditionTrue {
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonFailed, stalled.Message)
	}

	ready := apimeta.FindStatusCondition(release.Status.Conditions, fluxmeta.ReadyCondition)
	switch {
	case ready == nil:
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonProgressing, "Waiting for helm release status")
	case ready.Status == metav1.ConditionTrue:
		return databaseCondition(metav1.ConditionTrue, v1.DatabaseReasonReady, "Helm release is ready")
	case ready.Reason == helmv2.InstallFailedReason,
		ready.Reason == helmv2.UpgradeFailedReason,
		ready.Reason == helmv2.RollbackFailedReason:
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonFailed, ready.Message)
	default:
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonProgressing, ready.Message)
	}
}

func (r *ServiceReconciler) postgresCondition(ctx context.Context, service *v1.Service) metav1.Condition {
	var list postgresv1.PostgresqlList
	if err := r.List(ctx, &list, client.InNamespace(service.Namespace)); err != nil {
		return databaseListErrorCondition(err)
	}
	for i := range list.Items {
		postgres := &list.Items[i]
		if !metav1.IsControlledBy(postgres, service) {
			continue
		}
		return postgresStatusCondition(postgres)
	}
	return databaseNotCreatedCondition()
}

func postgresStatusCondition(postgres *postgresv1.Postgresql) metav1.Condition {
	clusterStatus := postgres.Status.PostgresClusterStatus
	switch clusterStatus {
	case postgresv1.ClusterStatusRunning:
		return databaseCondition(metav1.ConditionTrue, v1.DatabaseReasonReady, "Postgres cluster is running")
	case postgresv1.ClusterStatusAddFailed,
		postgresv1.ClusterStatusUpdateFailed,
		postgresv1.ClusterStatusSyncFailed,
		postgresv1.ClusterStatusInvalid:
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonFailed, fmt.Sprintf("Postgres cluster status: %s", clusterStatus))
	default:
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonProgressing, fmt.Sprintf("Postgres cluster status: %s", clusterStatus))
	}
}

func (r *ServiceReconciler) mysqlCondition(ctx context.Context, service *v1.Service) metav1.Condition {
	var list mocov1beta2.MySQLClusterList
	if err := r.List(ctx, &list, client.InNamespace(service.Namespace)); err != nil {
		return databaseListErrorCondition(err)
	}
	for i := range list.Items {
		cluster := &list.Items[i]
		if !metav1.IsControlledBy(cluster, service) {
			continue
		}
		return mysqlStatusCondition(cluster)
	}
	return databaseNotCreatedCondition()
}

func mysqlStatusCondition(cluster *mocov1beta2.MySQLCluster) metav1.Condition {
	healthy := apimeta.FindStatusCondition(cluster.Status.Conditions, mocov1beta2.ConditionHealthy)
	available := apimeta.FindStatusCondition(cluster.Status.Conditions, mocov1beta2.ConditionAvailable)
	initialized := apimeta.FindStatusCondition(cluster.Status.Conditions, mocov1beta2.ConditionInitialized)

	switch {
	case healthy != nil && healthy.Status == metav1.ConditionTrue:
		return databaseCondition(metav1.ConditionTrue, v1.DatabaseReasonReady, "MySQL cluster is healthy")
	case initialized != nil && initialized.Status == metav1.ConditionTrue &&
		available != nil && available.Status == metav1.ConditionFalse:
		message := available.Message
		if healthy != nil && healthy.Message != "" {
			message = healthy.Message
		}
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonFailed, fmt.Sprintf("MySQL cluster is unavailable: %s", message))
	default:
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonProgressing, "MySQL cluster is starting")
	}
}

func (r *ServiceReconciler) clickhouseCondition(ctx context.Context, service *v1.Service) metav1.Condition {
	var list altinityv1.ClickHouseInstallationList
	if err := r.List(ctx, &list, client.InNamespace(service.Namespace)); err != nil {
		return databaseListErrorCondition(err)
	}
	for i := range list.Items {
		installation := &list.Items[i]
		if !metav1.IsControlledBy(installation, service) {
			continue
		}
		return clickhouseStatusCondition(installation)
	}
	return databaseNotCreatedCondition()
}

func clickhouseStatusCondition(installation *altinityv1.ClickHouseInstallation) metav1.Condition {
	status := installation.Status
	if status == nil {
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonProgressing, "Waiting for clickhouse status")
	}
	switch status.Status {
	case altinityv1.StatusCompleted:
		return databaseCondition(metav1.ConditionTrue, v1.DatabaseReasonReady, "Clickhouse installation is complete")
	case altinityv1.StatusAborted:
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonFailed, fmt.Sprintf("Clickhouse installation aborted (task %s)", status.TaskID))
	default:
		return databaseCondition(metav1.ConditionFalse, v1.DatabaseReasonProgressing, fmt.Sprintf("Clickhouse installation status: %s", status.Status))
	}
}
