package variables_service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_project "github.com/unbindapp/unbind-api/mocks/repository/project"
	mocks_repository_service "github.com/unbindapp/unbind-api/mocks/repository/service"
	mocks_repository_system "github.com/unbindapp/unbind-api/mocks/repository/system"
	mocks_repository_team "github.com/unbindapp/unbind-api/mocks/repository/team"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	runtimeschema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
)

const legacyTestServiceID = "3f2a9c1e-7b4d-4e8a-9f0c-1d2e3f4a5b6c"

func TestRewriteLegacyServiceReferences(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    string
		changed bool
	}{
		{"a legacy reference", "${{service." + legacyTestServiceID + ".DATABASE_URL}}", "${{service:" + legacyTestServiceID + ".DATABASE_URL}}", true},
		{"every legacy reference in a value", "postgres://${{service." + legacyTestServiceID + ".USER}}@${{service." + legacyTestServiceID + ".UNBIND_HOST_PRIVATE}}/db", "postgres://${{service:" + legacyTestServiceID + ".USER}}@${{service:" + legacyTestServiceID + ".UNBIND_HOST_PRIVATE}}/db", true},
		{"scope and migrated references stay", "${{service." + legacyTestServiceID + ".A}} ${{team.B}} ${{service:" + legacyTestServiceID + ".C}}", "${{service:" + legacyTestServiceID + ".A}} ${{team.B}} ${{service:" + legacyTestServiceID + ".C}}", true},
		{"an already migrated value", "${{service:" + legacyTestServiceID + ".A}}", "${{service:" + legacyTestServiceID + ".A}}", false},
		{"not a service id", "${{service.abc.KEY}} ${service." + legacyTestServiceID + ".KEY}", "${{service.abc.KEY}} ${service." + legacyTestServiceID + ".KEY}", false},
		{"plain text", "hello", "hello", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := rewriteLegacyServiceReferences(tt.value)
			assert.Equal(t, tt.want, got)
			assert.Equal(t, tt.changed, changed)
		})
	}
}

type referenceSyntaxMocks struct {
	service *VariablesService
	system  *mocks_repository_system.SystemRepositoryMock
	k8s     *mocks_infrastructure_k8s.KubeClientMock
	client  *kubernetes.Clientset
	team    *ent.Team
}

func newReferenceSyntaxMocks(t *testing.T) *referenceSyntaxMocks {
	repo := mocks_repositories.NewRepositoriesMock(t)
	system := mocks_repository_system.NewSystemRepositoryMock(t)
	teams := mocks_repository_team.NewTeamRepositoryMock(t)
	projects := mocks_repository_project.NewProjectRepositoryMock(t)
	services := mocks_repository_service.NewServiceRepositoryMock(t)
	k8s := mocks_infrastructure_k8s.NewKubeClientMock(t)
	client := &kubernetes.Clientset{}

	repo.EXPECT().System().Return(system).Maybe()
	repo.EXPECT().Team().Return(teams).Maybe()
	repo.EXPECT().Project().Return(projects).Maybe()
	repo.EXPECT().Service().Return(services).Maybe()
	k8s.EXPECT().GetInternalClient().Return(client).Maybe()

	team := &ent.Team{ID: uuid.New(), Namespace: "unbind-team", KubernetesSecret: "team-secret"}
	project := &ent.Project{ID: uuid.New(), TeamID: team.ID, KubernetesSecret: "project-secret"}
	project.Edges.Environments = []*ent.Environment{{ID: uuid.New(), KubernetesSecret: "env-secret"}}
	app := &ent.Service{ID: uuid.New(), KubernetesSecret: "app-secret"}

	teams.EXPECT().GetAll(mock.Anything, mock.Anything).Return([]*ent.Team{team}, nil).Maybe()
	projects.EXPECT().GetByTeam(mock.Anything, team.ID, mock.Anything, mock.Anything, models.SortByCreatedAt, models.SortOrderAsc).Return([]*ent.Project{project}, nil).Maybe()
	services.EXPECT().GetByScope(mock.Anything, schema.VariableReferenceSourceTypeTeam, team.ID).Return([]*ent.Service{app}, nil).Maybe()

	return &referenceSyntaxMocks{
		service: &VariablesService{repo: repo, k8s: k8s},
		system:  system,
		k8s:     k8s,
		client:  client,
		team:    team,
	}
}

func (m *referenceSyntaxMocks) secrets(values map[string]map[string][]byte) {
	for _, name := range []string{"team-secret", "project-secret", "env-secret", "app-secret"} {
		data, ok := values[name]
		if !ok {
			m.k8s.EXPECT().GetSecretMap(mock.Anything, name, m.team.Namespace, m.client).
				Return(nil, k8serrors.NewNotFound(runtimeschema.GroupResource{Resource: "secrets"}, name)).Once()
			continue
		}
		m.k8s.EXPECT().GetSecretMap(mock.Anything, name, m.team.Namespace, m.client).Return(data, nil).Once()
	}
}

func TestMigrateServiceReferenceSyntax_RewritesLegacyReferences(t *testing.T) {
	m := newReferenceSyntaxMocks(t)
	m.system.EXPECT().GetSystemSettings(mock.Anything, mock.Anything).Return(&ent.SystemSetting{}, nil).Once()
	m.secrets(map[string]map[string][]byte{
		"team-secret": {"REGION": []byte("eu")},
		"env-secret":  {"API": []byte("${{service." + legacyTestServiceID + ".UNBIND_URL_PRIVATE}}/v1")},
		"app-secret": {
			"DATABASE_URL": []byte("${{service." + legacyTestServiceID + ".DATABASE_URL}}"),
			"REGION":       []byte("${{team.REGION}}"),
		},
	})
	m.k8s.EXPECT().UpsertSecretValues(mock.Anything, "env-secret", m.team.Namespace, map[string][]byte{
		"API": []byte("${{service:" + legacyTestServiceID + ".UNBIND_URL_PRIVATE}}/v1"),
	}, m.client).Return(nil, nil).Once()
	m.k8s.EXPECT().UpsertSecretValues(mock.Anything, "app-secret", m.team.Namespace, map[string][]byte{
		"DATABASE_URL": []byte("${{service:" + legacyTestServiceID + ".DATABASE_URL}}"),
	}, m.client).Return(nil, nil).Once()
	m.system.EXPECT().MarkServiceReferenceSyntaxMigrated(mock.Anything).Return(nil).Once()

	require.NoError(t, m.service.MigrateServiceReferenceSyntax(context.Background()))
}

func TestMigrateServiceReferenceSyntax_SkipsOnceMigrated(t *testing.T) {
	m := newReferenceSyntaxMocks(t)
	m.system.EXPECT().GetSystemSettings(mock.Anything, mock.Anything).Return(&ent.SystemSetting{ServiceReferenceSyntaxMigrated: true}, nil).Once()

	require.NoError(t, m.service.MigrateServiceReferenceSyntax(context.Background()))
}

func TestMigrateServiceReferenceSyntax_FailureIsNotMarked(t *testing.T) {
	m := newReferenceSyntaxMocks(t)
	m.system.EXPECT().GetSystemSettings(mock.Anything, mock.Anything).Return(nil, &ent.NotFoundError{}).Once()
	m.k8s.EXPECT().GetSecretMap(mock.Anything, "team-secret", m.team.Namespace, m.client).
		Return(map[string][]byte{"A": []byte("${{service." + legacyTestServiceID + ".A}}")}, nil).Once()
	m.k8s.EXPECT().UpsertSecretValues(mock.Anything, "team-secret", m.team.Namespace, mock.Anything, m.client).
		Return(nil, errors.New("conflict")).Once()

	require.Error(t, m.service.MigrateServiceReferenceSyntax(context.Background()))
}
