package k8s

import (
	"bytes"
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/pkg/databases"
	"k8s.io/apimachinery/pkg/api/errors"
)

// SyncDatabaseSecrets syncs all database secrets with the operator logic, returning
// the changed variable keys per service so callers can redeploy referencing services
func (self *KubeClient) SyncDatabaseSecrets(ctx context.Context) (map[uuid.UUID][]string, error) {
	databaseServices, err := self.repo.Service().GetDatabases(ctx)
	if err != nil {
		return nil, err
	}

	changed := make(map[uuid.UUID][]string)
	for _, service := range databaseServices {
		changedKeys, err := self.syncDatabaseSecret(ctx, service, true)
		if err != nil {
			log.Errorf("Failed to sync secret for service %s: %v", service.ID, err)
			// Continue with other services even if one fails
			continue
		}
		if len(changedKeys) > 0 {
			changed[service.ID] = changedKeys
		}
	}
	return changed, nil
}

// SyncDatabaseSecretForServiceID syncs the database secret for a specific service ID
func (self *KubeClient) SyncDatabaseSecretForServiceID(ctx context.Context, serviceID uuid.UUID) error {
	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("failed to get service %s: %w", serviceID, err)
	}

	_, err = self.SyncDatabaseSecretForService(ctx, service)
	return err
}

// SyncDatabaseSecretForService fills in credentials the secret is still missing,
// returning the keys whose values changed. Stored credentials are left alone: only
// SyncDatabaseSecrets replaces them, because its caller redeploys the services that
// were rendered with the old values.
func (self *KubeClient) SyncDatabaseSecretForService(ctx context.Context, service *ent.Service) ([]string, error) {
	return self.syncDatabaseSecret(ctx, service, false)
}

type engineCredentials struct {
	secretName  string
	username    string
	usernameKey string
	passwordKey string
}

// engineCredentialsFor locates the credentials the engine generated. Redis has none,
// its password lives in the service secret itself.
func engineCredentialsFor(service *ent.Service, postgresDBName string) (engineCredentials, bool) {
	switch *service.Database {
	case "postgres":
		return engineCredentials{
			secretName:  fmt.Sprintf("%s.%s.credentials.postgresql.acid.zalan.do", postgresDBName, service.KubernetesName),
			usernameKey: "username",
			passwordKey: "password",
		}, true
	case "mongodb":
		return engineCredentials{
			secretName:  fmt.Sprintf("%s-mongo-secret", service.ID.String()),
			username:    "root",
			passwordKey: "mongodb-root-password",
		}, true
	case "mysql":
		return engineCredentials{
			secretName:  fmt.Sprintf("moco-%s", service.KubernetesName),
			username:    "moco-writable",
			passwordKey: "WRITABLE_PASSWORD",
		}, true
	case "clickhouse":
		return engineCredentials{
			secretName:  fmt.Sprintf("%s-clickhouse-secret", service.ID.String()),
			username:    "default",
			passwordKey: "password",
		}, true
	}
	return engineCredentials{}, false
}

// syncDatabaseSecret copies the engine's credentials into the service secret. The
// engine owns them, so with replaceStored its values win over whatever is stored.
func (self *KubeClient) syncDatabaseSecret(ctx context.Context, service *ent.Service, replaceStored bool) ([]string, error) {
	if service.Type != schema.ServiceTypeDatabase {
		return nil, nil
	}

	// Validate service has necessary relationships
	if service.Database == nil || service.Edges.Environment == nil ||
		service.Edges.Environment.Edges.Project == nil ||
		service.Edges.Environment.Edges.Project.Edges.Team == nil {
		return nil, fmt.Errorf("service %s does not have a database or environment or project or team", service.ID)
	}

	namespace := service.Edges.Environment.Edges.Project.Edges.Team.Namespace

	secret, err := self.GetSecret(ctx, service.KubernetesSecret, namespace, self.GetInternalClient())
	if err != nil {
		return nil, fmt.Errorf("failed to get secret %s in namespace %s: %w", service.KubernetesSecret, namespace, err)
	}

	username := string(secret.Data["DATABASE_USERNAME"])
	password := string(secret.Data["DATABASE_PASSWORD"])
	defaultDBName := string(secret.Data["DATABASE_DEFAULT_DB_NAME"])
	var staleKeys []string

	postgresDBName := "primarydb"
	if service.Edges.ServiceConfig.DatabaseConfig != nil {
		if service.Edges.ServiceConfig.DatabaseConfig.DefaultDatabaseName != "" {
			postgresDBName = service.Edges.ServiceConfig.DatabaseConfig.DefaultDatabaseName
		}
	}

	stored := username != "" && password != ""
	if engine, ok := engineCredentialsFor(service, postgresDBName); ok && (replaceStored || !stored) {
		engineSecret, err := self.GetSecret(ctx, engine.secretName, namespace, self.GetInternalClient())
		// Stored credentials outlive an engine secret that is gone
		if err != nil && (!stored || !errors.IsNotFound(err)) {
			return nil, fmt.Errorf("failed to get secret %s in namespace %s: %w", engine.secretName, namespace, err)
		}
		if err == nil {
			engineUsername := engine.username
			if engine.usernameKey != "" {
				engineUsername = string(engineSecret.Data[engine.usernameKey])
			}
			if enginePassword := string(engineSecret.Data[engine.passwordKey]); engineUsername != "" && enginePassword != "" {
				username, password = engineUsername, enginePassword
			}
		}
	}

	if username == "" || password == "" {
		return nil, fmt.Errorf("secret %s in namespace %s does not have username or password", service.KubernetesSecret, namespace)
	}

	// Only the credentials are stored. Hosts, ports and connection strings are
	// computed from them when a variable is rendered, so there is no stored copy to
	// go stale or to disagree with the config.
	dbType := *service.Database
	secrets := map[string][]byte{
		"DATABASE_USERNAME": []byte(username),
		"DATABASE_PASSWORD": []byte(password),
	}
	if defaultDBName == "" || replaceStored {
		name := databases.DefaultDatabaseName(dbType)
		if dbType == "postgres" {
			name = postgresDBName
		}
		if name != "" {
			secrets["DATABASE_DEFAULT_DB_NAME"] = []byte(name)
		}
	}

	// Addresses moved to the computed UNBIND_* keys; drop the copies left behind
	for _, key := range databases.StoredAddressKeys {
		if _, ok := secret.Data[key]; ok {
			staleKeys = append(staleKeys, key)
		}
	}

	var changedKeys []string
	for k, v := range secrets {
		if !bytes.Equal(secret.Data[k], v) {
			changedKeys = append(changedKeys, k)
		}
	}
	if len(changedKeys) == 0 && len(staleKeys) == 0 {
		return nil, nil
	}

	if _, err := self.UpsertSecretValues(ctx, secret.Name, namespace, secrets, self.GetInternalClient()); err != nil {
		return nil, fmt.Errorf("failed to update secret %s in namespace %s: %w", secret.Name, namespace, err)
	}
	if len(staleKeys) > 0 {
		if err := self.RemoveSecretValues(ctx, secret.Name, namespace, staleKeys, self.GetInternalClient()); err != nil {
			return nil, fmt.Errorf("failed to remove stored addresses from secret %s in namespace %s: %w", secret.Name, namespace, err)
		}
	}

	return changedKeys, nil
}
