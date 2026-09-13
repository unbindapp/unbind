package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/unbindapp/unbind-api/pkg/databases"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

const (
	secretWaitAttempts = 10
	secretWaitInterval = 2 * time.Second
)

// syncCredentialSecret waits for the operator-managed source secret, then fills the
// target secret named by service.Spec.KubernetesSecret with connection details.
// When createIfMissing is false a missing target is treated as a no-op (the target is
// expected to be created elsewhere); otherwise it is created on demand.
func (r *ServiceReconciler) syncCredentialSecret(ctx context.Context, service *v1.Service, sourceName string, createIfMissing bool, fill func(target, source *corev1.Secret)) error {
	logger := log.FromContext(ctx)

	source, err := r.waitForSecret(ctx, service.Namespace, sourceName, service.Spec.KubernetesSecret)
	if err != nil {
		return err
	}

	target := &corev1.Secret{}
	err = r.Get(ctx, types.NamespacedName{Namespace: service.Namespace, Name: service.Spec.KubernetesSecret}, target)
	if err != nil {
		if !createIfMissing {
			return nil
		}
		if !errors.IsNotFound(err) {
			return fmt.Errorf("failed to check if target secret exists: %w", err)
		}

		target = &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: service.Spec.KubernetesSecret, Namespace: service.Namespace},
			Type:       corev1.SecretTypeOpaque,
			Data:       map[string][]byte{},
		}
		fill(target, source)
		if err := r.Create(ctx, target); err != nil {
			return fmt.Errorf("failed to create target secret: %w", err)
		}
		return nil
	}

	if hasDatabaseCredentials(target) {
		logger.Info("Target secret already has credentials, skipping copy", "target", service.Spec.KubernetesSecret)
		return nil
	}

	logger.Info("Copying credentials into target secret", "target", service.Spec.KubernetesSecret)
	if target.Data == nil {
		target.Data = map[string][]byte{}
	}
	fill(target, source)
	if err := r.Update(ctx, target); err != nil {
		return fmt.Errorf("failed to update target secret: %w", err)
	}
	return nil
}

// waitForSecret polls for a secret until it appears or the attempt budget is exhausted.
func (r *ServiceReconciler) waitForSecret(ctx context.Context, namespace, name, target string) (*corev1.Secret, error) {
	logger := log.FromContext(ctx)
	secret := &corev1.Secret{}

	var err error
	for attempt := range secretWaitAttempts {
		err = r.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, secret)
		if err == nil {
			return secret, nil
		}
		if !errors.IsNotFound(err) {
			return nil, fmt.Errorf("failed to get secret %s: %w", name, err)
		}
		logger.Info("Source secret not found yet, retrying", "secret", name, "attempt", attempt+1, "target", target)
		time.Sleep(secretWaitInterval)
	}

	return nil, fmt.Errorf("failed to get secret %s after retries: %w", name, err)
}

// hasDatabaseCredentials reports whether the secret already carries the standard
// connection keys, so they are not overwritten on subsequent reconciles.
func hasDatabaseCredentials(secret *corev1.Secret) bool {
	for _, key := range []string{"DATABASE_USERNAME", "DATABASE_PASSWORD"} {
		if _, ok := secret.Data[key]; !ok {
			return false
		}
	}
	return true
}

// copyPostgresCredentials copies credentials from the Zalando PostgreSQL secret to the target secret.
func (r *ServiceReconciler) copyPostgresCredentials(ctx context.Context, service *v1.Service) error {
	dbName := r.getPGDefaultDatabaseName(service)
	sourceName := fmt.Sprintf("%s.%s.credentials.postgresql.acid.zalan.do", dbName, service.Name)
	return r.syncCredentialSecret(ctx, service, sourceName, false, func(target, source *corev1.Secret) {
		updatePostgresSecretData(target, source, service, dbName)
	})
}

// copyMySQLCredentials copies credentials from the MOCO MySQL secret to the target secret.
func (r *ServiceReconciler) copyMySQLCredentials(ctx context.Context, service *v1.Service) error {
	sourceName := fmt.Sprintf("moco-%s", service.Name)
	return r.syncCredentialSecret(ctx, service, sourceName, true, func(target, source *corev1.Secret) {
		updateMySQLSecretData(target, source, service)
	})
}

// copyMongoDBCredentials copies credentials from the MongoDB secret to the target secret.
func (r *ServiceReconciler) copyMongoDBCredentials(ctx context.Context, service *v1.Service) error {
	sourceName := fmt.Sprintf("%s-mongo-secret", service.Spec.ServiceRef)
	return r.syncCredentialSecret(ctx, service, sourceName, true, func(target, source *corev1.Secret) {
		updateMongoDBSecretData(target, source, service)
	})
}

// copyClickhouseCredentials copies credentials from the ClickHouse secret to the target secret.
func (r *ServiceReconciler) copyClickhouseCredentials(ctx context.Context, service *v1.Service) error {
	sourceName := fmt.Sprintf("%s-clickhouse-secret", service.Spec.ServiceRef)
	return r.syncCredentialSecret(ctx, service, sourceName, true, func(target, source *corev1.Secret) {
		updateClickhouseSecretData(target, source, service)
	})
}

// writeCredentials stores the credentials an engine generated. Only these are stored:
// hosts, ports and connection strings are computed from them when a variable is
// rendered, so there is no copy that can go stale.
func writeCredentials(target *corev1.Secret, conn databases.Connection) {
	if conn.Username != "" {
		target.Data["DATABASE_USERNAME"] = []byte(conn.Username)
	}
	if conn.Password != "" {
		target.Data["DATABASE_PASSWORD"] = []byte(conn.Password)
	}
	if conn.Database != "" {
		target.Data["DATABASE_DEFAULT_DB_NAME"] = []byte(conn.Database)
	}
	// Addresses moved to the computed UNBIND_* keys
	for _, key := range databases.StoredAddressKeys {
		delete(target.Data, key)
	}
}

func credentials(databaseType, username string, password []byte, database string) databases.Connection {
	return databases.Connection{
		Type:     databaseType,
		Username: username,
		Password: string(password),
		Database: database,
	}
}

// updatePostgresSecretData writes the standard connection keys from a Zalando secret.
func updatePostgresSecretData(target, source *corev1.Secret, service *v1.Service, dbName string) {
	writeCredentials(target, credentials("postgres", string(source.Data["username"]), source.Data["password"], dbName))
}

// updateMySQLSecretData writes the standard connection keys from a MOCO secret.
func updateMySQLSecretData(target, source *corev1.Secret, service *v1.Service) {
	writeCredentials(target, credentials("mysql", "moco-writable", source.Data["WRITABLE_PASSWORD"], databases.DefaultDatabaseName("mysql")))
}

// updateMongoDBSecretData writes the standard connection keys from a MongoDB secret.
func updateMongoDBSecretData(target, source *corev1.Secret, service *v1.Service) {
	writeCredentials(target, credentials("mongodb", "root", source.Data["mongodb-root-password"], databases.DefaultDatabaseName("mongodb")))
}

// updateClickhouseSecretData writes the standard connection keys from a ClickHouse secret.
func updateClickhouseSecretData(target, source *corev1.Secret, service *v1.Service) {
	writeCredentials(target, credentials("clickhouse", "default", source.Data["password"], databases.DefaultDatabaseName("clickhouse")))
}

func serviceFQDN(name, namespace string) string {
	return fmt.Sprintf("%s.%s.svc.cluster.local", name, namespace)
}
