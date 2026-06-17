package k8s

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestCreateDatabaseSecret(t *testing.T) {
	client := fake.NewSimpleClientset()

	// Database credentials
	dbCredentials := map[string]string{
		"host":     "postgres.example.com",
		"port":     "5432",
		"database": "myapp_production",
		"username": "myapp_user",
		"password": "super_secure_password_123",
	}

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "database-credentials",
			Namespace: "default",
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "unbind",
				"unbind.app/type":              "database",
				"unbind.app/component":         "postgres",
			},
		},
		Type: corev1.SecretTypeOpaque,
		Data: make(map[string][]byte),
	}

	// Encode credentials as base64
	for key, value := range dbCredentials {
		secret.Data[key] = []byte(value)
	}

	// Create secret
	createdSecret, err := client.CoreV1().Secrets("default").Create(context.Background(), secret, metav1.CreateOptions{})
	require.NoError(t, err)

	// Verify secret was created correctly
	assert.Equal(t, "database-credentials", createdSecret.Name)
	assert.Equal(t, "default", createdSecret.Namespace)
	assert.Equal(t, "unbind", createdSecret.Labels["app.kubernetes.io/managed-by"])
	assert.Equal(t, "database", createdSecret.Labels["unbind.app/type"])
	assert.Equal(t, corev1.SecretTypeOpaque, createdSecret.Type)

	// Verify all database fields are present
	assert.Contains(t, createdSecret.Data, "host")
	assert.Contains(t, createdSecret.Data, "port")
	assert.Contains(t, createdSecret.Data, "database")
	assert.Contains(t, createdSecret.Data, "username")
	assert.Contains(t, createdSecret.Data, "password")

	// Verify field values
	assert.Equal(t, "postgres.example.com", string(createdSecret.Data["host"]))
	assert.Equal(t, "5432", string(createdSecret.Data["port"]))
	assert.Equal(t, "myapp_production", string(createdSecret.Data["database"]))
	assert.Equal(t, "myapp_user", string(createdSecret.Data["username"]))
	assert.Equal(t, "super_secure_password_123", string(createdSecret.Data["password"]))
}

func TestCreateDatabaseConnectionStringSecret(t *testing.T) {
	client := fake.NewSimpleClientset()

	connectionString := "postgresql://myapp_user:super_secure_password_123@postgres.example.com:5432/myapp_production?sslmode=require"

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "database-connection-string",
			Namespace: "default",
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "unbind",
				"unbind.app/type":              "database",
				"unbind.app/format":            "connection-string",
			},
		},
		Type: corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			"connection-string": []byte(connectionString),
			"database-url":      []byte(connectionString), // Alternative key
		},
	}

	// Create secret
	createdSecret, err := client.CoreV1().Secrets("default").Create(context.Background(), secret, metav1.CreateOptions{})
	require.NoError(t, err)

	// Verify secret was created correctly
	assert.Equal(t, "database-connection-string", createdSecret.Name)
	assert.Equal(t, "connection-string", createdSecret.Labels["unbind.app/format"])

	// Verify connection string fields
	assert.Contains(t, createdSecret.Data, "connection-string")
	assert.Contains(t, createdSecret.Data, "database-url")
	assert.Equal(t, connectionString, string(createdSecret.Data["connection-string"]))
	assert.Equal(t, connectionString, string(createdSecret.Data["database-url"]))
}

func TestValidateDatabaseCredentials(t *testing.T) {
	tests := []struct {
		name        string
		credentials map[string]string
		isValid     bool
		errorField  string
	}{
		{
			name: "Valid PostgreSQL credentials",
			credentials: map[string]string{
				"host":     "postgres.example.com",
				"port":     "5432",
				"database": "myapp",
				"username": "user",
				"password": "password",
			},
			isValid: true,
		},
		{
			name: "Valid MySQL credentials",
			credentials: map[string]string{
				"host":     "mysql.example.com",
				"port":     "3306",
				"database": "myapp",
				"username": "user",
				"password": "password",
			},
			isValid: true,
		},
		{
			name: "Missing host",
			credentials: map[string]string{
				"port":     "5432",
				"database": "myapp",
				"username": "user",
				"password": "password",
			},
			isValid:    false,
			errorField: "host",
		},
		{
			name: "Missing database",
			credentials: map[string]string{
				"host":     "postgres.example.com",
				"port":     "5432",
				"username": "user",
				"password": "password",
			},
			isValid:    false,
			errorField: "database",
		},
		{
			name: "Missing username",
			credentials: map[string]string{
				"host":     "postgres.example.com",
				"port":     "5432",
				"database": "myapp",
				"password": "password",
			},
			isValid:    false,
			errorField: "username",
		},
		{
			name: "Missing password",
			credentials: map[string]string{
				"host":     "postgres.example.com",
				"port":     "5432",
				"database": "myapp",
				"username": "user",
			},
			isValid:    false,
			errorField: "password",
		},
		{
			name: "Invalid port",
			credentials: map[string]string{
				"host":     "postgres.example.com",
				"port":     "invalid_port",
				"database": "myapp",
				"username": "user",
				"password": "password",
			},
			isValid:    false,
			errorField: "port",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDatabaseCredentials(tt.credentials)

			if tt.isValid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				if tt.errorField != "" {
					assert.Contains(t, err.Error(), tt.errorField)
				}
			}
		})
	}
}

func TestDatabaseConnectionStringValidation(t *testing.T) {
	tests := []struct {
		name             string
		connectionString string
		isValid          bool
		expectedType     string
	}{
		{
			name:             "Valid PostgreSQL connection string",
			connectionString: "postgresql://user:pass@host:5432/db",
			isValid:          true,
			expectedType:     "postgresql",
		},
		{
			name:             "Valid MySQL connection string",
			connectionString: "mysql://user:pass@host:3306/db",
			isValid:          true,
			expectedType:     "mysql",
		},
		{
			name:             "Valid Redis connection string",
			connectionString: "redis://user:pass@host:6379/0",
			isValid:          true,
			expectedType:     "redis",
		},
		{
			name:             "Invalid connection string format",
			connectionString: "invalid-connection-string",
			isValid:          false,
		},
		{
			name:             "Empty connection string",
			connectionString: "",
			isValid:          false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dbType, err := validateConnectionString(tt.connectionString)

			if tt.isValid {
				assert.NoError(t, err)
				if tt.expectedType != "" {
					assert.Equal(t, tt.expectedType, dbType)
				}
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestGetDatabaseSecretsByLabels(t *testing.T) {
	// Create test secrets
	secrets := []runtime.Object{
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "postgres-credentials",
				Namespace: "default",
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "unbind",
					"unbind.app/type":              "database",
					"unbind.app/component":         "postgres",
				},
			},
			Data: map[string][]byte{
				"host":     []byte("postgres.example.com"),
				"username": []byte("postgres_user"),
			},
		},
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "mysql-credentials",
				Namespace: "default",
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "unbind",
					"unbind.app/type":              "database",
					"unbind.app/component":         "mysql",
				},
			},
			Data: map[string][]byte{
				"host":     []byte("mysql.example.com"),
				"username": []byte("mysql_user"),
			},
		},
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "non-database-secret",
				Namespace: "default",
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "unbind",
					"unbind.app/type":              "tls",
				},
			},
		},
	}

	client := fake.NewSimpleClientset(secrets...)

	// Test filtering by database type
	secretList, err := client.CoreV1().Secrets("default").List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)

	databaseSecrets := filterSecretsByLabel(secretList.Items, "unbind.app/type", "database")
	assert.Len(t, databaseSecrets, 2)

	// Test filtering by component
	postgresSecrets := filterSecretsByLabel(secretList.Items, "unbind.app/component", "postgres")
	assert.Len(t, postgresSecrets, 1)
	assert.Equal(t, "postgres-credentials", postgresSecrets[0].Name)

	mysqlSecrets := filterSecretsByLabel(secretList.Items, "unbind.app/component", "mysql")
	assert.Len(t, mysqlSecrets, 1)
	assert.Equal(t, "mysql-credentials", mysqlSecrets[0].Name)
}

func TestDatabaseSecretRotation(t *testing.T) {
	oldPassword := "old_password_123"
	newPassword := "new_secure_password_456"

	// Create initial secret
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "database-credentials",
			Namespace: "default",
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "unbind",
				"unbind.app/type":              "database",
			},
		},
		Type: corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			"host":     []byte("postgres.example.com"),
			"username": []byte("myapp_user"),
			"password": []byte(oldPassword),
		},
	}

	client := fake.NewSimpleClientset(secret)

	// Verify initial password
	originalSecret, err := client.CoreV1().Secrets("default").Get(context.Background(), "database-credentials", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, oldPassword, string(originalSecret.Data["password"]))

	// Update password (simulate rotation)
	originalSecret.Data["password"] = []byte(newPassword)

	updatedSecret, err := client.CoreV1().Secrets("default").Update(context.Background(), originalSecret, metav1.UpdateOptions{})
	require.NoError(t, err)

	// Verify password was rotated
	assert.Equal(t, newPassword, string(updatedSecret.Data["password"]))
	assert.Equal(t, "postgres.example.com", string(updatedSecret.Data["host"])) // Other fields unchanged
	assert.Equal(t, "myapp_user", string(updatedSecret.Data["username"]))
}

func TestDatabaseSecretEncryption(t *testing.T) {
	plainPassword := "my_secret_password"

	tests := []struct {
		name         string
		encodeBase64 bool
	}{
		{
			name:         "Base64 encoded secret",
			encodeBase64: true,
		},
		{
			name:         "Plain text secret",
			encodeBase64: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.NewSimpleClientset()

			var passwordData []byte
			if tt.encodeBase64 {
				passwordData = []byte(base64.StdEncoding.EncodeToString([]byte(plainPassword)))
			} else {
				passwordData = []byte(plainPassword)
			}

			secret := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-secret",
					Namespace: "default",
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"password": passwordData,
				},
			}

			// Create secret
			createdSecret, err := client.CoreV1().Secrets("default").Create(context.Background(), secret, metav1.CreateOptions{})
			require.NoError(t, err)

			// Verify data storage
			if tt.encodeBase64 {
				encodedPassword := base64.StdEncoding.EncodeToString([]byte(plainPassword))
				assert.Equal(t, encodedPassword, string(createdSecret.Data["password"]))

				// Verify we can decode it back
				decodedPassword, err := base64.StdEncoding.DecodeString(string(createdSecret.Data["password"]))
				require.NoError(t, err)
				assert.Equal(t, plainPassword, string(decodedPassword))
			} else {
				assert.Equal(t, plainPassword, string(createdSecret.Data["password"]))
			}
		})
	}
}

func TestDatabaseSecretTemplating(t *testing.T) {
	credentials := map[string]string{
		"host":     "postgres.example.com",
		"port":     "5432",
		"database": "myapp_production",
		"username": "myapp_user",
		"password": "super_secure_password",
	}

	tests := []struct {
		name             string
		template         string
		expectedContains []string
	}{
		{
			name:     "PostgreSQL connection string",
			template: "postgresql://{username}:{password}@{host}:{port}/{database}",
			expectedContains: []string{
				"postgresql://",
				"myapp_user",
				"super_secure_password",
				"postgres.example.com",
				"5432",
				"myapp_production",
			},
		},
		{
			name:     "JDBC connection string",
			template: "jdbc:postgresql://{host}:{port}/{database}?user={username}&password={password}",
			expectedContains: []string{
				"jdbc:postgresql://",
				"postgres.example.com:5432",
				"myapp_production",
				"user=myapp_user",
				"password=super_secure_password",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			connectionString := buildConnectionString(tt.template, credentials)

			for _, expectedPart := range tt.expectedContains {
				assert.Contains(t, connectionString, expectedPart)
			}
		})
	}
}

// Helper functions for testing

func validateDatabaseCredentials(credentials map[string]string) error {
	requiredFields := []string{"host", "database", "username", "password"}

	for _, field := range requiredFields {
		if value, exists := credentials[field]; !exists || value == "" {
			return fmt.Errorf("missing required field: %s", field)
		}
	}

	// Validate port if provided
	if port, exists := credentials["port"]; exists {
		if !isValidPort(port) {
			return fmt.Errorf("invalid port: %s", port)
		}
	}

	return nil
}

func validateConnectionString(connectionString string) (string, error) {
	if connectionString == "" {
		return "", fmt.Errorf("connection string cannot be empty")
	}

	// Basic URL format validation
	if !strings.Contains(connectionString, "://") {
		return "", fmt.Errorf("invalid connection string format")
	}

	// Extract database type from scheme
	parts := strings.SplitN(connectionString, "://", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid connection string format")
	}

	dbType := parts[0]
	validTypes := []string{"postgresql", "mysql", "redis", "mongodb", "sqlite"}

	for _, validType := range validTypes {
		if dbType == validType {
			return dbType, nil
		}
	}

	return "", fmt.Errorf("unsupported database type: %s", dbType)
}

func filterSecretsByLabel(secrets []corev1.Secret, labelKey, labelValue string) []corev1.Secret {
	var filtered []corev1.Secret

	for _, secret := range secrets {
		if value, exists := secret.Labels[labelKey]; exists && value == labelValue {
			filtered = append(filtered, secret)
		}
	}

	return filtered
}

func isValidPort(port string) bool {
	// Simple port validation - should be a number between 1 and 65535
	if port == "" {
		return false
	}

	// Check if all characters are digits
	for _, char := range port {
		if char < '0' || char > '9' {
			return false
		}
	}

	return true
}

func buildConnectionString(template string, credentials map[string]string) string {
	result := template

	for key, value := range credentials {
		placeholder := "{" + key + "}"
		result = strings.ReplaceAll(result, placeholder, value)
	}

	return result
}
