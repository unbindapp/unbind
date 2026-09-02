package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestCredentialSecretHostsAreFQDN(t *testing.T) {
	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "db-abc123", Namespace: "unbind-team"}}
	newSecret := func(data map[string][]byte) *corev1.Secret {
		return &corev1.Secret{Data: data}
	}

	tests := []struct {
		name         string
		fill         func(target, source *corev1.Secret)
		source       map[string][]byte
		expectedHost string
		expectedURL  string
	}{
		{
			name:         "postgres",
			fill:         func(target, source *corev1.Secret) { updatePostgresSecretData(target, source, service, "primarydb") },
			source:       map[string][]byte{"username": []byte("app"), "password": []byte("pw")},
			expectedHost: "db-abc123.unbind-team.svc.cluster.local",
			expectedURL:  "postgresql://app:pw@db-abc123.unbind-team.svc.cluster.local:5432/primarydb?sslmode=disable",
		},
		{
			name:         "mysql",
			fill:         func(target, source *corev1.Secret) { updateMySQLSecretData(target, source, service) },
			source:       map[string][]byte{"WRITABLE_PASSWORD": []byte("pw")},
			expectedHost: "moco-db-abc123.unbind-team.svc.cluster.local",
			expectedURL:  "mysql://moco-writable:pw@moco-db-abc123.unbind-team.svc.cluster.local:3306/moco",
		},
		{
			name:         "mongodb",
			fill:         func(target, source *corev1.Secret) { updateMongoDBSecretData(target, source, service) },
			source:       map[string][]byte{"mongodb-root-password": []byte("pw")},
			expectedHost: "db-abc123.unbind-team.svc.cluster.local",
			expectedURL:  "mongodb://root:pw@db-abc123.unbind-team.svc.cluster.local:27017/admin?ssl=false",
		},
		{
			name:         "clickhouse",
			fill:         func(target, source *corev1.Secret) { updateClickhouseSecretData(target, source, service) },
			source:       map[string][]byte{"password": []byte("pw")},
			expectedHost: "clickhouse-db-abc123.unbind-team.svc.cluster.local",
			expectedURL:  "clickhouse://default:pw@clickhouse-db-abc123.unbind-team.svc.cluster.local:9000/default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target := newSecret(map[string][]byte{})
			tt.fill(target, newSecret(tt.source))
			assert.Equal(t, tt.expectedHost, string(target.Data["DATABASE_HOST"]))
			assert.Equal(t, tt.expectedURL, string(target.Data["DATABASE_URL"]))
		})
	}
}
