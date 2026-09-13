package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/pkg/databases"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Only credentials are stored; the addresses moved to the computed UNBIND_* keys
func TestCredentialSecretStoresOnlyCredentials(t *testing.T) {
	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "db-abc123", Namespace: "unbind-team"}}
	newSecret := func(data map[string][]byte) *corev1.Secret {
		return &corev1.Secret{Data: data}
	}

	tests := []struct {
		name             string
		fill             func(target, source *corev1.Secret)
		source           map[string][]byte
		expectedUsername string
		expectedDatabase string
	}{
		{
			name:             "postgres",
			fill:             func(target, source *corev1.Secret) { updatePostgresSecretData(target, source, service, "primarydb") },
			source:           map[string][]byte{"username": []byte("unbind"), "password": []byte("pw")},
			expectedUsername: "unbind",
			expectedDatabase: "primarydb",
		},
		{
			name:             "mysql",
			fill:             func(target, source *corev1.Secret) { updateMySQLSecretData(target, source, service) },
			source:           map[string][]byte{"WRITABLE_PASSWORD": []byte("pw")},
			expectedUsername: "moco-writable",
			expectedDatabase: "moco",
		},
		{
			name:             "mongodb",
			fill:             func(target, source *corev1.Secret) { updateMongoDBSecretData(target, source, service) },
			source:           map[string][]byte{"mongodb-root-password": []byte("pw")},
			expectedUsername: "root",
			expectedDatabase: "admin",
		},
		{
			name:             "clickhouse",
			fill:             func(target, source *corev1.Secret) { updateClickhouseSecretData(target, source, service) },
			source:           map[string][]byte{"password": []byte("pw")},
			expectedUsername: "default",
			expectedDatabase: "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// A secret written by an older release still carries the addresses
			target := newSecret(map[string][]byte{"DATABASE_HOST": []byte("stale"), "DATABASE_URL": []byte("stale")})
			tt.fill(target, newSecret(tt.source))

			assert.Equal(t, tt.expectedUsername, string(target.Data["DATABASE_USERNAME"]))
			assert.Equal(t, "pw", string(target.Data["DATABASE_PASSWORD"]))
			assert.Equal(t, tt.expectedDatabase, string(target.Data["DATABASE_DEFAULT_DB_NAME"]))
			for _, key := range databases.StoredAddressKeys {
				assert.NotContains(t, target.Data, key)
			}
		})
	}
}
