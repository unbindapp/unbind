package controller

import (
	"context"
	"fmt"
	"time"

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
	for _, key := range []string{"DATABASE_USERNAME", "DATABASE_PASSWORD", "DATABASE_URL"} {
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

// updatePostgresSecretData writes the standard connection keys from a Zalando secret.
func updatePostgresSecretData(target, source *corev1.Secret, service *v1.Service, dbName string) {
	if username, ok := source.Data["username"]; ok {
		target.Data["DATABASE_USERNAME"] = username
	}
	if password, ok := source.Data["password"]; ok {
		target.Data["DATABASE_PASSWORD"] = password
	}
	target.Data["DATABASE_URL"] = fmt.Appendf(nil, "postgresql://%s:%s@%s.%s:%d/%s?sslmode=disable", target.Data["DATABASE_USERNAME"], target.Data["DATABASE_PASSWORD"], service.Name, service.Namespace, 5432, dbName)
	target.Data["DATABASE_DEFAULT_DB_NAME"] = []byte(dbName)
	target.Data["DATABASE_PORT"] = []byte("5432")
	target.Data["DATABASE_HOST"] = fmt.Appendf(nil, "%s.%s", service.Name, service.Namespace)
}

// updateMySQLSecretData writes the standard connection keys from a MOCO secret.
func updateMySQLSecretData(target, source *corev1.Secret, service *v1.Service) {
	target.Data["DATABASE_USERNAME"] = []byte("moco-writable")
	if password, ok := source.Data["WRITABLE_PASSWORD"]; ok {
		target.Data["DATABASE_PASSWORD"] = password
	}

	username := string(target.Data["DATABASE_USERNAME"])
	password := string(target.Data["DATABASE_PASSWORD"])
	target.Data["DATABASE_URL"] = fmt.Appendf(nil, "mysql://%s:%s@moco-%s.%s:%d/moco", username, password, service.Name, service.Namespace, 3306)
	target.Data["DATABASE_DEFAULT_DB_NAME"] = []byte("moco")
	target.Data["DATABASE_PORT"] = []byte("3306")
	target.Data["DATABASE_HOST"] = fmt.Appendf(nil, "moco-%s.%s", service.Name, service.Namespace)
}

// updateMongoDBSecretData writes the standard connection keys from a MongoDB secret.
func updateMongoDBSecretData(target, source *corev1.Secret, service *v1.Service) {
	target.Data["DATABASE_USERNAME"] = []byte("root")
	if password, ok := source.Data["mongodb-root-password"]; ok {
		target.Data["DATABASE_PASSWORD"] = password
	}

	password := string(target.Data["DATABASE_PASSWORD"])
	target.Data["DATABASE_URL"] = fmt.Appendf(nil, "mongodb://%s:%s@%s.%s:27017/admin?ssl=false", "root", password, service.Name, service.Namespace)
	target.Data["DATABASE_DEFAULT_DB_NAME"] = []byte("admin")
	target.Data["DATABASE_PORT"] = []byte("27017")
	target.Data["DATABASE_HOST"] = fmt.Appendf(nil, "%s.%s", service.Name, service.Namespace)
}

// updateClickhouseSecretData writes the standard connection keys from a ClickHouse secret.
func updateClickhouseSecretData(target, source *corev1.Secret, service *v1.Service) {
	target.Data["DATABASE_USERNAME"] = []byte("default")
	if password, ok := source.Data["password"]; ok {
		target.Data["DATABASE_PASSWORD"] = password
	}

	password := string(target.Data["DATABASE_PASSWORD"])
	target.Data["DATABASE_URL"] = fmt.Appendf(nil, "clickhouse://%s:%s@clickhouse-%s.%s:9000/default", "default", password, service.Name, service.Namespace)
	target.Data["DATABASE_HTTP_URL"] = fmt.Appendf(nil, "http://%s:%s@clickhouse-%s.%s:8123/default", "default", password, service.Name, service.Namespace)
	target.Data["DATABASE_DEFAULT_DB_NAME"] = []byte("default")
	target.Data["DATABASE_PORT"] = []byte("9000")
	target.Data["DATABASE_HTTP_PORT"] = []byte("8123")
	target.Data["DATABASE_HOST"] = fmt.Appendf(nil, "clickhouse-%s.%s", service.Name, service.Namespace)
}
