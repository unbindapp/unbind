package controller

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"slices"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

// reconcileDatabase handles Service resources of type "database": it installs the
// dependent operator when required, provisions any managed credential secrets, then
// reconciles the rendered database objects.
func (r *ServiceReconciler) reconcileDatabase(ctx context.Context, rb resourcebuilder.ResourceBuilderInterface, service v1.Service) error {
	logger := log.FromContext(ctx)
	logger.Info("Reconciling database", "service", fmt.Sprintf("%s/%s", service.Namespace, service.Name))

	controllerNamespace := os.Getenv("POD_NAMESPACE")
	if controllerNamespace == "" {
		return fmt.Errorf("POD_NAMESPACE environment variable not set")
	}

	dbType := service.Spec.Config.Database.Type
	if slices.Contains([]string{"mysql", "clickhouse"}, dbType) {
		if err := r.OperatorManager.EnsureOperatorInstalled(ctx, logger, dbType, controllerNamespace); err != nil {
			logger.Error(err, "Failed to ensure operator is installed")
			return err
		}
	}

	if err := r.ensureDatabaseSecret(ctx, &service); err != nil {
		return err
	}

	runtimeObjects, err := rb.BuildDatabaseObjects(ctx, logger)
	if err != nil {
		return fmt.Errorf("failed to build database objects: %w", err)
	}

	if err := r.reconcileRuntimeObjects(ctx, runtimeObjects, service); err != nil {
		logger.Error(err, "Failed to reconcile runtime objects")
		return err
	}

	return nil
}

// ensureDatabaseSecret provisions the source secret a managed database needs before
// its objects are rendered. Engines without a pre-provisioned secret are a no-op.
func (r *ServiceReconciler) ensureDatabaseSecret(ctx context.Context, service *v1.Service) error {
	logger := log.FromContext(ctx)

	switch service.Spec.Config.Database.Type {
	case "redis":
		if service.Spec.KubernetesSecret == "" {
			return nil
		}
		if err := r.ensureRedisSecret(ctx, service); err != nil {
			logger.Error(err, "Failed to ensure Redis secret")
			return err
		}
	case "mongodb":
		secretName := fmt.Sprintf("%s-mongo-secret", service.Spec.ServiceRef)
		keys := []string{"mongodb-root-password", "mongodb-replica-set-key"}
		if err := r.ensureManagedDBSecret(ctx, service, secretName, keys, r.copyMongoDBCredentials); err != nil {
			logger.Error(err, "Failed to ensure MongoDB secret")
			return err
		}
	case "clickhouse":
		secretName := fmt.Sprintf("%s-clickhouse-secret", service.Spec.ServiceRef)
		keys := []string{"password", "backup-password"}
		if err := r.ensureManagedDBSecret(ctx, service, secretName, keys, r.copyClickhouseCredentials); err != nil {
			logger.Error(err, "Failed to ensure ClickHouse secret")
			return err
		}
	}

	return nil
}

// ensureManagedDBSecret creates the named secret with a generated value per key when
// missing, backfills any individually missing keys on an existing secret, and copies
// the resulting credentials into the target secret when one is configured.
func (r *ServiceReconciler) ensureManagedDBSecret(ctx context.Context, service *v1.Service, secretName string, keys []string, copyCredentials func(context.Context, *v1.Service) error) error {
	logger := log.FromContext(ctx)

	secret := &corev1.Secret{}
	err := r.Get(ctx, types.NamespacedName{Namespace: service.Namespace, Name: secretName}, secret)
	if err != nil {
		if !errors.IsNotFound(err) {
			return fmt.Errorf("failed to check if secret %s exists: %w", secretName, err)
		}

		secret = &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: secretName, Namespace: service.Namespace},
			Type:       corev1.SecretTypeOpaque,
			Data:       map[string][]byte{},
		}
		if err := generatePasswords(secret, keys); err != nil {
			return err
		}
		if err := controllerutil.SetControllerReference(service, secret, r.Scheme); err != nil {
			return fmt.Errorf("failed to set controller reference: %w", err)
		}
		logger.Info("Creating managed database secret", "secretName", secretName)
		if err := r.Create(ctx, secret); err != nil {
			return fmt.Errorf("failed to create secret %s: %w", secretName, err)
		}
		return r.copyManagedCredentials(ctx, service, copyCredentials)
	}

	missing := slices.DeleteFunc(slices.Clone(keys), func(key string) bool {
		_, ok := secret.Data[key]
		return ok
	})
	if len(missing) == 0 {
		return nil
	}

	if secret.Data == nil {
		secret.Data = map[string][]byte{}
	}
	if err := generatePasswords(secret, missing); err != nil {
		return err
	}
	if err := controllerutil.SetControllerReference(service, secret, r.Scheme); err != nil {
		return fmt.Errorf("failed to set controller reference: %w", err)
	}
	logger.Info("Updating managed database secret", "secretName", secretName)
	if err := r.Update(ctx, secret); err != nil {
		return fmt.Errorf("failed to update secret %s: %w", secretName, err)
	}
	return r.copyManagedCredentials(ctx, service, copyCredentials)
}

func (r *ServiceReconciler) copyManagedCredentials(ctx context.Context, service *v1.Service, copyCredentials func(context.Context, *v1.Service) error) error {
	if service.Spec.KubernetesSecret == "" {
		return nil
	}
	return copyCredentials(ctx, service)
}

func generatePasswords(secret *corev1.Secret, keys []string) error {
	for _, key := range keys {
		password, err := generateSecurePassword()
		if err != nil {
			return fmt.Errorf("failed to generate %s: %w", key, err)
		}
		secret.Data[key] = []byte(password)
	}
	return nil
}

// ensureRedisSecret creates a secret with a generated password for Redis, or backfills
// the full connection details onto an existing secret that lacks a password.
func (r *ServiceReconciler) ensureRedisSecret(ctx context.Context, service *v1.Service) error {
	logger := log.FromContext(ctx)
	secretName := service.Spec.KubernetesSecret

	secret := &corev1.Secret{}
	err := r.Get(ctx, types.NamespacedName{Namespace: service.Namespace, Name: secretName}, secret)
	if err != nil {
		if !errors.IsNotFound(err) {
			return fmt.Errorf("failed to check if Redis secret exists: %w", err)
		}

		password, err := generateSecurePassword()
		if err != nil {
			return fmt.Errorf("failed to generate Redis password: %w", err)
		}
		newSecret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: secretName, Namespace: service.Namespace},
			Type:       corev1.SecretTypeOpaque,
			Data:       map[string][]byte{"DATABASE_PASSWORD": []byte(password)},
		}
		logger.Info("Creating new Redis secret", "secretName", secretName)
		if err := r.Create(ctx, newSecret); err != nil {
			return fmt.Errorf("failed to create Redis secret: %w", err)
		}
		return nil
	}

	if _, ok := secret.Data["DATABASE_PASSWORD"]; ok {
		return nil
	}

	password, err := generateSecurePassword()
	if err != nil {
		return fmt.Errorf("failed to generate Redis password: %w", err)
	}
	if secret.Data == nil {
		secret.Data = map[string][]byte{}
	}
	secret.Data["DATABASE_USERNAME"] = []byte("default")
	secret.Data["DATABASE_PASSWORD"] = []byte(password)
	secret.Data["DATABASE_URL"] = fmt.Appendf(nil, "redis://%s:%s@%s-headless.%s:%d", "default", password, service.Name, service.Namespace, 6379)
	secret.Data["DATABASE_PORT"] = []byte("6379")
	secret.Data["DATABASE_HOST"] = fmt.Appendf(nil, "%s-headless.%s", service.Name, service.Namespace)

	logger.Info("Updating existing Redis secret", "secretName", secretName)
	if err := r.Update(ctx, secret); err != nil {
		return fmt.Errorf("failed to update Redis secret: %w", err)
	}
	return nil
}

func (r *ServiceReconciler) getPGDefaultDatabaseName(service *v1.Service) string {
	dbConfig := service.Spec.Config.Database.Config.AsMap()
	name := "primarydb"
	if dbConfig["defaultDatabaseName"] != nil && dbConfig["defaultDatabaseName"] != "" {
		name, _ = dbConfig["defaultDatabaseName"].(string)
		if name == "" {
			name = "postgres"
		}
	}
	return name
}

func generateSecurePassword() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b)[:32], nil
}
