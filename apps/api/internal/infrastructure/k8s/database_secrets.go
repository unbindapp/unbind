package k8s

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"k8s.io/apimachinery/pkg/api/errors"
)

// SyncDatabaseSecrets syncs all database secrets with the operator logic
func (self *KubeClient) SyncDatabaseSecrets(ctx context.Context) error {
	// Get all database services
	databaseServices, err := self.repo.Service().GetDatabases(ctx)
	if err != nil {
		return err
	}

	for _, service := range databaseServices {
		if err := self.SyncDatabaseSecretForService(ctx, service); err != nil {
			log.Errorf("Failed to sync secret for service %s: %v", service.ID, err)
			// Continue with other services even if one fails
			continue
		}
	}
	return nil
}

// SyncDatabaseSecretForServiceID syncs the database secret for a specific service ID
func (self *KubeClient) SyncDatabaseSecretForServiceID(ctx context.Context, serviceID uuid.UUID) error {
	// Get the specific service
	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("failed to get service %s: %w", serviceID, err)
	}

	return self.SyncDatabaseSecretForService(ctx, service)
}

// SyncDatabaseSecretForService syncs the database secret for a specific service
func (self *KubeClient) SyncDatabaseSecretForService(ctx context.Context, service *ent.Service) error {
	if service.Type != schema.ServiceTypeDatabase {
		return nil
	}

	// Validate service has necessary relationships
	if service.Database == nil || service.Edges.Environment == nil ||
		service.Edges.Environment.Edges.Project == nil ||
		service.Edges.Environment.Edges.Project.Edges.Team == nil {
		return fmt.Errorf("service %s does not have a database or environment or project or team", service.ID)
	}

	namespace := service.Edges.Environment.Edges.Project.Edges.Team.Namespace

	// Get the existing secret
	secret, err := self.GetSecret(ctx, service.KubernetesSecret, namespace, self.GetInternalClient())
	if err != nil {
		return fmt.Errorf("failed to get secret %s in namespace %s: %w", service.KubernetesSecret, namespace, err)
	}

	username := string(secret.Data["DATABASE_USERNAME"])
	password := string(secret.Data["DATABASE_PASSWORD"])
	host := string(secret.Data["DATABASE_HOST"])
	defaultDBName := string(secret.Data["DATABASE_DEFAULT_DB_NAME"])
	existingUrl := string(secret.Data["DATABASE_URL"])
	existingHttpUrl := string(secret.Data["DATABASE_HTTP_URL"])

	// For postgres, we can sync username and password if they are empty
	postgresDBName := "primarydb"
	if service.Edges.ServiceConfig.DatabaseConfig != nil {
		if service.Edges.ServiceConfig.DatabaseConfig.DefaultDatabaseName != "" {
			postgresDBName = service.Edges.ServiceConfig.DatabaseConfig.DefaultDatabaseName
		}
	}
	if *service.Database == "postgres" && (username == "" || password == "") {
		zalandoSecretName := fmt.Sprintf("%s.%s.credentials.postgresql.acid.zalan.do", postgresDBName, service.Name)
		zalandoSecret, err := self.GetSecret(ctx, zalandoSecretName, namespace, self.GetInternalClient())
		if err != nil {
			if errors.IsNotFound(err) {
				return fmt.Errorf("secret %s in namespace %s not found: %w", zalandoSecretName, namespace, err)
			}
			return fmt.Errorf("failed to get secret %s in namespace %s: %w", zalandoSecretName, namespace, err)
		}
		username = string(zalandoSecret.Data["username"])
		password = string(zalandoSecret.Data["password"])
	}

	// For mongo we can sync too
	if *service.Database == "mongodb" && (username == "" || password == "") {
		mongoSecretName := fmt.Sprintf("%s-mongo-secret", service.ID.String())
		mongoSecret, err := self.GetSecret(ctx, mongoSecretName, namespace, self.GetInternalClient())
		if err != nil {
			if errors.IsNotFound(err) {
				return fmt.Errorf("secret %s in namespace %s not found: %w", mongoSecretName, namespace, err)
			}
			return fmt.Errorf("failed to get secret %s in namespace %s: %w", mongoSecretName, namespace, err)
		}

		username = "root"
		password = string(mongoSecret.Data["mongodb-root-password"])
	}

	// For mysql we can sync too
	if *service.Database == "mysql" && (username == "" || password == "") {
		mysqlSecretName := fmt.Sprintf("moco-%s", service.KubernetesName)
		mysqlSecret, err := self.GetSecret(ctx, mysqlSecretName, namespace, self.GetInternalClient())
		if err != nil {
			if errors.IsNotFound(err) {
				return fmt.Errorf("secret %s in namespace %s not found: %w", mysqlSecretName, namespace, err)
			}
			return fmt.Errorf("failed to get secret %s in namespace %s: %w", mysqlSecretName, namespace, err)
		}

		username = "moco-writable"
		password = string(mysqlSecret.Data["WRITABLE_PASSWORD"])
	}

	// For clickhouse we can sync too
	if *service.Database == "clickhouse" && (username == "" || password == "") {
		clickhouseSecretName := fmt.Sprintf("%s-clickhouse-secret", service.ID.String())
		clickhouseSecret, err := self.GetSecret(ctx, clickhouseSecretName, namespace, self.GetInternalClient())
		if err != nil {
			if errors.IsNotFound(err) {
				return fmt.Errorf("secret %s in namespace %s not found: %w", clickhouseSecretName, namespace, err)
			}
			return fmt.Errorf("failed to get secret %s in namespace %s: %w", clickhouseSecretName, namespace, err)
		}
		username = "default"
		password = string(clickhouseSecret.Data["password"])
	}

	if username == "" || password == "" {
		return fmt.Errorf("secret %s in namespace %s does not have username or password", service.KubernetesSecret, namespace)
	}

	// Set database URL for database type
	var url string
	var httpUrl string
	switch *service.Database {
	case "postgres":
		host = fmt.Sprintf("%s.%s", service.KubernetesName, namespace)
		url = fmt.Sprintf("postgresql://%s:%s@%s:%d/%s?sslmode=disable", username, password, host, 5432, postgresDBName)
	case "redis":
		host = fmt.Sprintf("%s-headless.%s", service.KubernetesName, namespace)
		url = fmt.Sprintf("redis://%s:%s@%s:%d", "default", password, host, 6379)
	case "mysql":
		host = fmt.Sprintf("moco-%s.%s", service.KubernetesName, namespace)
		url = fmt.Sprintf("mysql://%s:%s@%s:%d/%s", username, password, host, 3306, "moco")
	case "mongodb":
		host = fmt.Sprintf("%s.%s", service.KubernetesName, namespace)
		url = fmt.Sprintf("mongodb://%s:%s@%s:27017/admin?ssl=false",
			username,
			password,
			host)
	case "clickhouse":
		host = fmt.Sprintf("clickhouse-%s.%s", service.KubernetesName, namespace)
		url = fmt.Sprintf("clickhouse://%s:%s@%s:9000/default", username, password, host)
		httpUrl = fmt.Sprintf("http://%s:%s@%s:8123/default", username, password, host)
	}

	secrets := map[string][]byte{
		"DATABASE_USERNAME": []byte(username),
		"DATABASE_PASSWORD": []byte(password),
		"DATABASE_HOST":     []byte(host),
	}
	if existingUrl != url && url != "" {
		secrets["DATABASE_URL"] = []byte(url)
	}
	if existingHttpUrl != httpUrl && httpUrl != "" {
		secrets["DATABASE_HTTP_URL"] = []byte(httpUrl)
	}
	if defaultDBName == "" {
		switch *service.Database {
		case "postgres":
			secrets["DATABASE_DEFAULT_DB_NAME"] = []byte(postgresDBName)
			// Always set port too
			secrets["DATABASE_PORT"] = []byte("5432")
		case "mysql":
			secrets["DATABASE_DEFAULT_DB_NAME"] = []byte("moco")
			secrets["DATABASE_PORT"] = []byte("3306")
		case "mongodb":
			secrets["DATABASE_DEFAULT_DB_NAME"] = []byte("admin")
			secrets["DATABASE_PORT"] = []byte("27017")
		case "redis":
			secrets["DATABASE_PORT"] = []byte("6379")
		case "clickhouse":
			secrets["DATABASE_DEFAULT_DB_NAME"] = []byte("default")
			secrets["DATABASE_PORT"] = []byte("9000")
			secrets["DATABASE_HTTP_PORT"] = []byte("8123")
		}
	}
	// Sync secret
	_, err = self.UpsertSecretValues(ctx, secret.Name, namespace, secrets, self.GetInternalClient())
	if err != nil {
		return fmt.Errorf("failed to update secret %s in namespace %s: %w", secret.Name, namespace, err)
	}

	return nil
}
