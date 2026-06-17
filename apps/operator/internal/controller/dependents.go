package controller

import (
	"context"
	"fmt"
	"reflect"
	"time"

	altinityv1 "github.com/altinity/clickhouse-operator/pkg/apis/clickhouse.altinity.com/v1"
	mocov1beta2 "github.com/cybozu-go/moco/api/v1beta2"
	helmv2 "github.com/fluxcd/helm-controller/api/v2"
	sourcev1 "github.com/fluxcd/source-controller/api/v1"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	postgresv1 "github.com/zalando/postgres-operator/pkg/apis/acid.zalan.do/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

// copyCredentialsAfter returns an afterReconcile hook that copies database credentials
// into the target secret, but only when the service declares one.
func (r *ServiceReconciler) copyCredentialsAfter(owner *v1.Service, copyCredentials func(context.Context, *v1.Service) error) func(context.Context) error {
	return func(ctx context.Context) error {
		if owner.Spec.KubernetesSecret == "" {
			return nil
		}
		if err := copyCredentials(ctx, owner); err != nil {
			log.FromContext(ctx).Error(err, "Failed to copy database credentials")
			return err
		}
		return nil
	}
}

// reconcilePostgresql reconciles a Zalando Postgresql resource.
func (r *ServiceReconciler) reconcilePostgresql(ctx context.Context, postgres *postgresv1.Postgresql, owner *v1.Service) error {
	return reconcileResource(ctx, r, postgres, owner, maxReconcileRetries,
		func(existing, desired *postgresv1.Postgresql) bool {
			return !reflect.DeepEqual(existing.Spec, desired.Spec)
		},
		func(existing, desired *postgresv1.Postgresql) { existing.Spec = desired.Spec },
		r.copyCredentialsAfter(owner, r.copyPostgresCredentials),
	)
}

// reconcileHelmRelease reconciles a Flux HelmRelease resource without retrying on conflict.
func (r *ServiceReconciler) reconcileHelmRelease(ctx context.Context, helmRelease *helmv2.HelmRelease, owner *v1.Service) error {
	return reconcileResource(ctx, r, helmRelease, owner, singleReconcileAttempt,
		func(existing, desired *helmv2.HelmRelease) bool {
			return !reflect.DeepEqual(existing.Spec, desired.Spec)
		},
		func(existing, desired *helmv2.HelmRelease) { existing.Spec = desired.Spec },
		nil,
	)
}

// reconcileHelmRepository reconciles a Flux HelmRepository resource without retrying on conflict.
func (r *ServiceReconciler) reconcileHelmRepository(ctx context.Context, helmRepo *sourcev1.HelmRepository, owner *v1.Service) error {
	return reconcileResource(ctx, r, helmRepo, owner, singleReconcileAttempt,
		func(existing, desired *sourcev1.HelmRepository) bool {
			return !reflect.DeepEqual(existing.Spec, desired.Spec)
		},
		func(existing, desired *sourcev1.HelmRepository) { existing.Spec = desired.Spec },
		nil,
	)
}

// reconcileMySQLCluster reconciles a MOCO MySQLCluster resource.
func (r *ServiceReconciler) reconcileMySQLCluster(ctx context.Context, mysqlcluster *mocov1beta2.MySQLCluster, owner *v1.Service) error {
	mysqlcluster.Spec.ServerIDBase = 100
	return reconcileResource(ctx, r, mysqlcluster, owner, maxReconcileRetries,
		func(existing, desired *mocov1beta2.MySQLCluster) bool {
			return !reflect.DeepEqual(existing.Spec, desired.Spec)
		},
		func(existing, desired *mocov1beta2.MySQLCluster) { existing.Spec = desired.Spec },
		r.copyCredentialsAfter(owner, r.copyMySQLCredentials),
	)
}

// reconcileBackupPolicy reconciles a MOCO BackupPolicy resource without retrying on conflict.
func (r *ServiceReconciler) reconcileBackupPolicy(ctx context.Context, backupPolicy *mocov1beta2.BackupPolicy, owner *v1.Service) error {
	return reconcileResource(ctx, r, backupPolicy, owner, singleReconcileAttempt,
		func(existing, desired *mocov1beta2.BackupPolicy) bool {
			return !reflect.DeepEqual(existing.Spec, desired.Spec)
		},
		func(existing, desired *mocov1beta2.BackupPolicy) { existing.Spec = desired.Spec },
		nil,
	)
}

// reconcileClickhouseInstallation reconciles an Altinity ClickHouseInstallation resource.
func (r *ServiceReconciler) reconcileClickhouseInstallation(ctx context.Context, clickhouse *altinityv1.ClickHouseInstallation, owner *v1.Service) error {
	return reconcileResource(ctx, r, clickhouse, owner, maxReconcileRetries,
		func(existing, desired *altinityv1.ClickHouseInstallation) bool {
			return !reflect.DeepEqual(existing.Spec, desired.Spec)
		},
		func(existing, desired *altinityv1.ClickHouseInstallation) { existing.Spec = desired.Spec },
		r.copyCredentialsAfter(owner, r.copyClickhouseCredentials),
	)
}

// reconcileJob reconciles a Job, recreating it when its container spec changes and it
// has not already run to completion. Jobs have immutable specs, so an in-place update
// is not possible.
func (r *ServiceReconciler) reconcileJob(ctx context.Context, desiredJob *batchv1.Job, owner *v1.Service) error {
	logger := log.FromContext(ctx)
	logger.Info("Reconciling Job", "name", desiredJob.Name, "namespace", desiredJob.Namespace)

	if err := controllerutil.SetControllerReference(owner, desiredJob, r.Scheme); err != nil {
		return fmt.Errorf("setting controller reference: %w", err)
	}

	var existingJob batchv1.Job
	err := r.Get(ctx, client.ObjectKey{Namespace: desiredJob.Namespace, Name: desiredJob.Name}, &existingJob)
	if err != nil {
		if errors.IsNotFound(err) {
			logger.Info("Creating Job", "name", desiredJob.Name)
			return r.Create(ctx, desiredJob)
		}
		return err
	}

	if jobFinished(&existingJob) || reflect.DeepEqual(existingJob.Spec.Template.Spec.Containers, desiredJob.Spec.Template.Spec.Containers) {
		logger.Info("Job already exists and no update needed", "name", desiredJob.Name)
		return nil
	}

	logger.Info("Deleting existing Job to recreate with new configuration", "name", existingJob.Name)
	if err := r.Delete(ctx, &existingJob, client.PropagationPolicy(metav1.DeletePropagationBackground)); err != nil {
		return fmt.Errorf("deleting Job: %w", err)
	}

	for retries := range 10 {
		err := r.Get(ctx, client.ObjectKey{Namespace: desiredJob.Namespace, Name: desiredJob.Name}, &existingJob)
		if errors.IsNotFound(err) {
			break
		}
		logger.Info("Waiting for Job to be deleted", "name", desiredJob.Name, "retry", retries+1)
		time.Sleep(1 * time.Second)
	}

	logger.Info("Creating new Job with updated configuration", "name", desiredJob.Name)
	return r.Create(ctx, desiredJob)
}

func jobFinished(job *batchv1.Job) bool {
	for _, condition := range job.Status.Conditions {
		if (condition.Type == batchv1.JobComplete || condition.Type == batchv1.JobFailed) && condition.Status == corev1.ConditionTrue {
			return true
		}
	}
	return false
}
