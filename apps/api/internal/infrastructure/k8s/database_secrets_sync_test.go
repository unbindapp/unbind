package k8s

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

const syncTestNamespace = "unbind-team"

func databaseServiceForSync(databaseType string) *ent.Service {
	return &ent.Service{
		ID:               uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Type:             schema.ServiceTypeDatabase,
		Database:         &databaseType,
		Name:             "My Database",
		KubernetesName:   "db-abc123",
		KubernetesSecret: "db-abc123-secret",
		Edges: ent.ServiceEdges{
			ServiceConfig: &ent.ServiceConfig{},
			Environment: &ent.Environment{Edges: ent.EnvironmentEdges{
				Project: &ent.Project{Edges: ent.ProjectEdges{
					Team: &ent.Team{Namespace: syncTestNamespace},
				}},
			}},
		},
	}
}

func syncTestSecret(name string, pairs ...string) *corev1.Secret {
	data := make(map[string][]byte, len(pairs)/2)
	for i := 0; i+1 < len(pairs); i += 2 {
		data[pairs[i]] = []byte(pairs[i+1])
	}
	return &corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: syncTestNamespace}, Data: data}
}

func TestSyncDatabaseSecret(t *testing.T) {
	zalando := "primarydb.db-abc123.credentials.postgresql.acid.zalan.do"

	tests := []struct {
		name          string
		databaseType  string
		replaceStored bool
		stored        *corev1.Secret
		engine        *corev1.Secret
		wantChanged   []string
		wantPassword  string
		wantErr       bool
	}{
		{
			name:          "drifted password is replaced by the engine's",
			databaseType:  "postgres",
			replaceStored: true,
			stored:        syncTestSecret("db-abc123-secret", "DATABASE_USERNAME", "unbind", "DATABASE_PASSWORD", "edited", "DATABASE_DEFAULT_DB_NAME", "primarydb"),
			engine:        syncTestSecret(zalando, "username", "unbind", "password", "real"),
			wantChanged:   []string{"DATABASE_PASSWORD"},
			wantPassword:  "real",
		},
		{
			name:          "matching credentials change nothing",
			databaseType:  "mysql",
			replaceStored: true,
			stored:        syncTestSecret("db-abc123-secret", "DATABASE_USERNAME", "moco-writable", "DATABASE_PASSWORD", "real", "DATABASE_DEFAULT_DB_NAME", "moco"),
			engine:        syncTestSecret("moco-db-abc123", "WRITABLE_PASSWORD", "real"),
			wantPassword:  "real",
		},
		{
			name:         "stored credentials are kept when only filling in",
			databaseType: "mongodb",
			stored:       syncTestSecret("db-abc123-secret", "DATABASE_USERNAME", "root", "DATABASE_PASSWORD", "edited", "DATABASE_DEFAULT_DB_NAME", "admin"),
			engine:       syncTestSecret("11111111-1111-1111-1111-111111111111-mongo-secret", "mongodb-root-password", "real"),
			wantPassword: "edited",
		},
		{
			name:         "missing credentials are filled in",
			databaseType: "clickhouse",
			stored:       syncTestSecret("db-abc123-secret"),
			engine:       syncTestSecret("11111111-1111-1111-1111-111111111111-clickhouse-secret", "password", "real"),
			wantChanged:  []string{"DATABASE_DEFAULT_DB_NAME", "DATABASE_PASSWORD", "DATABASE_USERNAME"},
			wantPassword: "real",
		},
		{
			name:          "an empty engine password never replaces a stored one",
			databaseType:  "postgres",
			replaceStored: true,
			stored:        syncTestSecret("db-abc123-secret", "DATABASE_USERNAME", "unbind", "DATABASE_PASSWORD", "kept", "DATABASE_DEFAULT_DB_NAME", "primarydb"),
			engine:        syncTestSecret(zalando, "username", "unbind", "password", ""),
			wantPassword:  "kept",
		},
		{
			name:          "a missing engine secret keeps the stored credentials",
			databaseType:  "postgres",
			replaceStored: true,
			stored:        syncTestSecret("db-abc123-secret", "DATABASE_USERNAME", "unbind", "DATABASE_PASSWORD", "kept", "DATABASE_DEFAULT_DB_NAME", "primarydb"),
			wantPassword:  "kept",
		},
		{
			name:          "redis keeps its own password",
			databaseType:  "redis",
			replaceStored: true,
			stored:        syncTestSecret("db-abc123-secret", "DATABASE_USERNAME", "default", "DATABASE_PASSWORD", "own"),
			wantPassword:  "own",
		},
		{
			name:         "no credentials anywhere is an error",
			databaseType: "postgres",
			stored:       syncTestSecret("db-abc123-secret"),
			wantErr:      true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			client := fake.NewSimpleClientset(test.stored)
			if test.engine != nil {
				_, err := client.CoreV1().Secrets(syncTestNamespace).Create(context.Background(), test.engine, metav1.CreateOptions{})
				require.NoError(t, err)
			}
			kubeClient := &KubeClient{clientset: client}

			changed, err := kubeClient.syncDatabaseSecret(context.Background(), databaseServiceForSync(test.databaseType), test.replaceStored)
			if test.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.ElementsMatch(t, test.wantChanged, changed)

			stored, err := client.CoreV1().Secrets(syncTestNamespace).Get(context.Background(), "db-abc123-secret", metav1.GetOptions{})
			require.NoError(t, err)
			assert.Equal(t, test.wantPassword, string(stored.Data["DATABASE_PASSWORD"]))
		})
	}
}
