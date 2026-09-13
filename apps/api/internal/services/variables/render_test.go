package variables_service

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_permissions "github.com/unbindapp/unbind-api/mocks/repository/permissions"
	mocks_repository_service "github.com/unbindapp/unbind-api/mocks/repository/service"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	runtimeschema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
)

// This service can't reuse services.ServiceTestSuite: deployctl imports
// variables_service, so importing the shared base would create a test import
// cycle. We wire up the handful of mocks it actually needs directly.
type RenderSuite struct {
	suite.Suite
	ctx       context.Context
	service   *VariablesService
	k8sClient *kubernetes.Clientset

	repo    *mocks_repositories.RepositoriesMock
	perms   *mocks_repository_permissions.PermissionsRepositoryMock
	svcRepo *mocks_repository_service.ServiceRepositoryMock
	k8s     *mocks_infrastructure_k8s.KubeClientMock

	team        *ent.Team
	project     *ent.Project
	environment *ent.Environment
	target      *ent.Service
}

func (suite *RenderSuite) SetupTest() {
	suite.ctx = context.Background()

	suite.repo = mocks_repositories.NewRepositoriesMock(suite.T())
	suite.perms = mocks_repository_permissions.NewPermissionsRepositoryMock(suite.T())
	suite.svcRepo = mocks_repository_service.NewServiceRepositoryMock(suite.T())
	suite.k8s = mocks_infrastructure_k8s.NewKubeClientMock(suite.T())

	suite.repo.EXPECT().Permissions().Return(suite.perms).Maybe()
	suite.repo.EXPECT().Service().Return(suite.svcRepo).Maybe()

	suite.service = &VariablesService{repo: suite.repo, k8s: suite.k8s}
	suite.k8sClient = &kubernetes.Clientset{}
	suite.k8s.EXPECT().GetInternalClient().Return(suite.k8sClient).Maybe()

	suite.team = &ent.Team{ID: uuid.New(), Name: "Team", Namespace: "unbind-team", KubernetesSecret: "team-secret"}
	suite.project = &ent.Project{ID: uuid.New(), Name: "Project", TeamID: suite.team.ID, KubernetesSecret: "project-secret"}
	suite.project.Edges.Team = suite.team
	suite.environment = &ent.Environment{ID: uuid.New(), Name: "Environment", ProjectID: suite.project.ID, KubernetesSecret: "env-secret"}
	suite.environment.Edges.Project = suite.project
	suite.target = suite.newService("web", schema.ServiceTypeGithub, nil)
}

func (suite *RenderSuite) newService(name string, serviceType schema.ServiceType, database *string) *ent.Service {
	service := &ent.Service{
		ID:               uuid.New(),
		Name:             name,
		Type:             serviceType,
		Database:         database,
		KubernetesName:   name + "-abc123",
		KubernetesSecret: name + "-secret",
		EnvironmentID:    suite.environment.ID,
	}
	service.Edges.Environment = suite.environment
	service.Edges.ServiceConfig = &ent.ServiceConfig{Icon: name + "-icon"}
	return service
}

func (suite *RenderSuite) expectSecret(name string, data map[string][]byte) {
	suite.k8s.EXPECT().GetSecretMap(suite.ctx, name, suite.team.Namespace, suite.k8sClient).Return(data, nil).Maybe()
}

func (suite *RenderSuite) expectMissingSecret(name string) {
	suite.k8s.EXPECT().GetSecretMap(suite.ctx, name, suite.team.Namespace, suite.k8sClient).
		Return(nil, k8serrors.NewNotFound(runtimeschema.GroupResource{Resource: "secrets"}, name)).Maybe()
}

func (suite *RenderSuite) TestRender_ServiceAndScopeReferences() {
	db := suite.newService("postgres", schema.ServiceTypeDatabase, utils.ToPtr("postgres"))
	suite.svcRepo.EXPECT().GetByIDs(suite.ctx, []uuid.UUID{db.ID}).Return([]*ent.Service{db}, nil).Once()
	suite.expectSecret(db.KubernetesSecret, map[string][]byte{"DATABASE_URL": []byte("postgres://db")})
	suite.expectSecret(suite.team.KubernetesSecret, map[string][]byte{"REGION": []byte("eu")})

	values := map[string][]byte{
		"PLAIN": []byte("literal ${not.a.token}"),
		"DSN":   []byte(vartemplate.ServiceToken(db.ID, "DATABASE_URL") + "?sslmode=disable"),
		"WHERE": []byte(vartemplate.ScopeToken(schema.VariableReferenceSourceTypeTeam, "REGION")),
	}

	result, err := suite.service.renderVariables(suite.ctx, suite.k8sClient, suite.target, values)
	suite.NoError(err)
	suite.Equal(map[string]string{
		"DSN":   "postgres://db?sslmode=disable",
		"WHERE": "eu",
	}, result.Env)
	suite.True(result.FullyResolved())
	suite.NotContains(result.Variables, "PLAIN")

	dsn := result.Variables["DSN"]
	suite.Len(dsn.References, 1)
	suite.Equal(models.VariableReferenceInfo{
		Token:         vartemplate.ServiceToken(db.ID, "DATABASE_URL"),
		SourceType:    schema.VariableReferenceSourceTypeService,
		SourceID:      db.ID,
		SourceName:    "postgres",
		SourceIcon:    "postgres-icon",
		Key:           "DATABASE_URL",
		Resolved:      true,
		ResolvedValue: utils.ToPtr("postgres://db"),
	}, dsn.References[0])

	where := result.Variables["WHERE"]
	suite.Equal("Team", where.References[0].SourceName)
	suite.Equal("team", where.References[0].SourceIcon)

	envVars := result.EnvVars()
	suite.Equal("DSN", envVars[0].Name)
	suite.Equal("WHERE", envVars[1].Name)
}

func (suite *RenderSuite) TestRender_UnresolvedStaysLiteral() {
	otherProject := suite.newService("foreign", schema.ServiceTypeGithub, nil)
	otherProject.Edges.Environment = &ent.Environment{ID: uuid.New(), ProjectID: uuid.New()}
	known := suite.newService("api", schema.ServiceTypeGithub, nil)
	missing := uuid.New()

	suite.svcRepo.EXPECT().GetByIDs(suite.ctx, sortedIDs(otherProject.ID, known.ID, missing)).Return([]*ent.Service{otherProject, known}, nil).Once()
	suite.expectMissingSecret(known.KubernetesSecret)

	values := map[string][]byte{
		"FOREIGN": []byte(vartemplate.ServiceToken(otherProject.ID, "KEY")),
		"NO_KEY":  []byte("x-" + vartemplate.ServiceToken(known.ID, "KEY")),
		"GONE":    []byte(vartemplate.ServiceToken(missing, "KEY")),
	}

	result, err := suite.service.renderVariables(suite.ctx, suite.k8sClient, suite.target, values)
	suite.NoError(err)
	suite.False(result.FullyResolved())
	suite.Equal(string(values["FOREIGN"]), result.Env["FOREIGN"])
	suite.Equal(string(values["NO_KEY"]), result.Env["NO_KEY"])
	suite.Equal(string(values["GONE"]), result.Env["GONE"])
	suite.Len(result.Unresolved, 3)
	suite.False(result.Variables["NO_KEY"].References[0].Resolved)
	suite.Equal("api", result.Variables["NO_KEY"].References[0].SourceName)
	suite.Empty(result.Variables["FOREIGN"].References[0].SourceName)
}

func (suite *RenderSuite) TestRender_EndpointKeys() {
	api := suite.newService("api", schema.ServiceTypeGithub, nil)
	api.Edges.ServiceConfig.IsPublic = true
	api.Edges.ServiceConfig.Ports = []schema.PortSpec{
		{Port: 9000, Protocol: utils.ToPtr(schema.ProtocolUDP)},
		{Port: 3000, Protocol: utils.ToPtr(schema.ProtocolTCP)},
		{Port: 4000, IsNodePort: true},
		{Port: 5000},
	}
	api.Edges.ServiceConfig.Hosts = []schema.HostSpec{
		{Host: "api.example.com", TargetPort: utils.ToPtr[int32](3000)},
		{Host: "www.example.com", TargetPort: utils.ToPtr[int32](5000)},
	}
	redis := suite.newService("redis", schema.ServiceTypeDatabase, utils.ToPtr("redis"))

	suite.svcRepo.EXPECT().GetByIDs(suite.ctx, sortedIDs(api.ID, redis.ID)).Return([]*ent.Service{api, redis}, nil).Once()
	suite.expectSecret(redis.KubernetesSecret, map[string][]byte{
		"DATABASE_PORT":     []byte("6379"),
		"DATABASE_PASSWORD": []byte("hunter2"),
	})

	values := map[string][]byte{
		"API_URL":      []byte(vartemplate.ServiceToken(api.ID, "UNBIND_URL_PRIVATE")),
		"API_URL_5000": []byte(vartemplate.ServiceToken(api.ID, "UNBIND_URL_PRIVATE_5000")),
		"API_URL_9999": []byte(vartemplate.ServiceToken(api.ID, "UNBIND_URL_PRIVATE_9999")),
		"API_PORT":     []byte(vartemplate.ServiceToken(api.ID, "UNBIND_PORT_PRIVATE")),
		"API_HOST":     []byte(vartemplate.ServiceToken(api.ID, "UNBIND_HOST_PRIVATE")),
		"PUBLIC":       []byte(vartemplate.ServiceToken(api.ID, "UNBIND_URL_PUBLIC_5000")),
		"PUBLIC_PORT":  []byte(vartemplate.ServiceToken(api.ID, "UNBIND_PORT_PUBLIC")),
		"REDIS_HOST":   []byte(vartemplate.ServiceToken(redis.ID, "UNBIND_HOST_PRIVATE")),
		"REDIS_PORT":   []byte(vartemplate.ServiceToken(redis.ID, "UNBIND_PORT_PRIVATE")),
		"REDIS_URL":    []byte(vartemplate.ServiceToken(redis.ID, "UNBIND_DATABASE_URL_PRIVATE")),
		"REDIS_NOPUB":  []byte(vartemplate.ServiceToken(redis.ID, "UNBIND_DATABASE_URL_PUBLIC")),
		"API_NOT_A_DB": []byte(vartemplate.ServiceToken(api.ID, "UNBIND_DATABASE_URL_PRIVATE")),
	}

	result, err := suite.service.renderVariables(suite.ctx, suite.k8sClient, suite.target, values)
	suite.NoError(err)
	suite.Equal("http://api-abc123.unbind-team.svc.cluster.local:3000", result.Env["API_URL"])
	suite.Equal("http://api-abc123.unbind-team.svc.cluster.local:5000", result.Env["API_URL_5000"])
	suite.Equal("api-abc123.unbind-team.svc.cluster.local", result.Env["API_HOST"])
	suite.Equal("3000", result.Env["API_PORT"])
	suite.Equal("https://www.example.com", result.Env["PUBLIC"])
	suite.Equal("443", result.Env["PUBLIC_PORT"])
	suite.Equal("redis-abc123-headless.unbind-team.svc.cluster.local", result.Env["REDIS_HOST"])
	suite.Equal("6379", result.Env["REDIS_PORT"])
	suite.Equal("redis://default:hunter2@redis-abc123-headless.unbind-team.svc.cluster.local:6379", result.Env["REDIS_URL"])

	// A port nobody exposes, a private database's public URL and an app's database
	// URL all stay literal
	suite.Equal(string(values["API_URL_9999"]), result.Env["API_URL_9999"])
	suite.Equal(string(values["REDIS_NOPUB"]), result.Env["REDIS_NOPUB"])
	suite.Equal(string(values["API_NOT_A_DB"]), result.Env["API_NOT_A_DB"])
	suite.Len(result.Unresolved, 3)
}

// References written before the public/private rename keep resolving, by position
func (suite *RenderSuite) TestRender_LegacyEndpointKeys() {
	api := suite.newService("api", schema.ServiceTypeGithub, nil)
	api.Edges.ServiceConfig.IsPublic = true
	api.Edges.ServiceConfig.Ports = []schema.PortSpec{{Port: 3000}, {Port: 5000}}
	api.Edges.ServiceConfig.Hosts = []schema.HostSpec{
		{Host: "api.example.com", TargetPort: utils.ToPtr[int32](3000)},
		{Host: "www.example.com", TargetPort: utils.ToPtr[int32](5000)},
	}

	suite.svcRepo.EXPECT().GetByIDs(suite.ctx, []uuid.UUID{api.ID}).Return([]*ent.Service{api}, nil).Once()

	values := map[string][]byte{
		"OLD_URL":   []byte(vartemplate.ServiceToken(api.ID, "UNBIND_INTERNAL_URL")),
		"OLD_URL_2": []byte(vartemplate.ServiceToken(api.ID, "UNBIND_INTERNAL_URL_2")),
		"OLD_HOST":  []byte(vartemplate.ServiceToken(api.ID, "UNBIND_INTERNAL_HOST")),
		"OLD_PUB_2": []byte(vartemplate.ServiceToken(api.ID, "UNBIND_EXTERNAL_URL_2")),
	}

	result, err := suite.service.renderVariables(suite.ctx, suite.k8sClient, suite.target, values)
	suite.NoError(err)
	suite.Equal("http://api-abc123.unbind-team.svc.cluster.local:3000", result.Env["OLD_URL"])
	suite.Equal("http://api-abc123.unbind-team.svc.cluster.local:5000", result.Env["OLD_URL_2"])
	suite.Equal("api-abc123.unbind-team.svc.cluster.local", result.Env["OLD_HOST"])
	suite.Equal("https://www.example.com", result.Env["OLD_PUB_2"])
	suite.True(result.FullyResolved())
}

// ClickHouse speaks two protocols, so it has an endpoint per port on both sides
func (suite *RenderSuite) TestRender_ClickhouseBothProtocols() {
	ch := suite.newService("analytics", schema.ServiceTypeDatabase, utils.ToPtr("clickhouse"))
	ch.Edges.ServiceConfig.IsPublic = true
	ch.Edges.ServiceConfig.Ports = []schema.PortSpec{
		{Port: 9000, IsNodePort: true, NodePort: utils.ToPtr[int32](30001)},
		{Port: 8123, IsNodePort: true, NodePort: utils.ToPtr[int32](30002)},
	}
	ch.Edges.ServiceConfig.Hosts = []schema.HostSpec{
		{Host: "ch.example.com", TargetPort: utils.ToPtr[int32](9000)},
		{Host: "ch.example.com", TargetPort: utils.ToPtr[int32](8123)},
	}

	suite.svcRepo.EXPECT().GetByIDs(suite.ctx, []uuid.UUID{ch.ID}).Return([]*ent.Service{ch}, nil).Once()
	suite.expectSecret(ch.KubernetesSecret, map[string][]byte{
		"DATABASE_USERNAME": []byte("default"),
		"DATABASE_PASSWORD": []byte("pw"),
	})

	values := map[string][]byte{
		"NATIVE":     []byte(vartemplate.ServiceToken(ch.ID, "UNBIND_DATABASE_URL_PRIVATE")),
		"HTTP":       []byte(vartemplate.ServiceToken(ch.ID, "UNBIND_DATABASE_URL_PRIVATE_8123")),
		"NATIVE_PUB": []byte(vartemplate.ServiceToken(ch.ID, "UNBIND_DATABASE_URL_PUBLIC")),
		"HTTP_PUB":   []byte(vartemplate.ServiceToken(ch.ID, "UNBIND_DATABASE_URL_PUBLIC_8123")),
		"HTTP_PORT":  []byte(vartemplate.ServiceToken(ch.ID, "UNBIND_PORT_PUBLIC_8123")),
	}

	result, err := suite.service.renderVariables(suite.ctx, suite.k8sClient, suite.target, values)
	suite.NoError(err)
	host := "clickhouse-analytics-abc123.unbind-team.svc.cluster.local"
	suite.Equal("clickhouse://default:pw@"+host+":9000/default", result.Env["NATIVE"])
	suite.Equal("http://default:pw@"+host+":8123/default", result.Env["HTTP"])
	suite.Equal("clickhouse://default:pw@ch.example.com:30001/default", result.Env["NATIVE_PUB"])
	suite.Equal("http://default:pw@ch.example.com:30002/default", result.Env["HTTP_PUB"])
	suite.Equal("30002", result.Env["HTTP_PORT"])
	suite.True(result.FullyResolved())
}

func (suite *RenderSuite) TestRenderedValuesChange() {
	token := vartemplate.ScopeToken(schema.VariableReferenceSourceTypeTeam, "A")
	existing := map[string][]byte{"PLAIN": []byte("1"), "REF": []byte(token)}
	change := func(upserts map[string][]byte, deletes []string, overwrite bool) bool {
		final := finalValues(existing, upserts, deletes, overwrite)
		return renderedValuesChange(existing, final, changedKeys(existing, final))
	}

	suite.False(change(map[string][]byte{"PLAIN": []byte("2")}, nil, false))
	suite.True(change(map[string][]byte{"NEW": []byte(token)}, nil, false))
	suite.True(change(map[string][]byte{"REF": []byte("now plain")}, nil, false))
	suite.False(change(map[string][]byte{"PLAIN": []byte("1")}, nil, false))
	suite.False(change(map[string][]byte{"REF": []byte(token)}, nil, false))
	suite.True(change(map[string][]byte{"PLAIN": []byte("1")}, nil, true))
	suite.True(change(nil, []string{"REF"}, false))
	suite.False(change(nil, []string{"PLAIN"}, false))
}

func (suite *RenderSuite) TestValidateReferences() {
	userID := uuid.New()
	api := suite.newService("api", schema.ServiceTypeGithub, nil)
	suite.target.Edges.ServiceConfig.VariableMounts = []*schema.VariableMount{{Name: "CONFIG", Path: "/etc/config"}}

	err := suite.service.validateReferences(suite.ctx, userID, suite.target, map[string][]byte{
		"CONFIG": []byte(vartemplate.ServiceToken(api.ID, "KEY")),
	})
	suite.ErrorContains(err, "mounted as a file")

	suite.svcRepo.EXPECT().GetByIDs(suite.ctx, []uuid.UUID{api.ID}).Return([]*ent.Service{api}, nil).Once()
	suite.perms.EXPECT().Check(suite.ctx, userID, []permissions_repo.PermissionCheck{{
		Action: schema.ActionViewer, ResourceType: schema.ResourceTypeService, ResourceID: api.ID,
	}}).Return(nil).Once()
	suite.perms.EXPECT().Check(suite.ctx, userID, []permissions_repo.PermissionCheck{{
		Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceID: suite.project.ID,
	}}).Return(nil).Once()
	err = suite.service.validateReferences(suite.ctx, userID, suite.target, map[string][]byte{
		"OK":    []byte(vartemplate.ServiceToken(api.ID, "KEY") + vartemplate.ServiceToken(api.ID, "OTHER")),
		"SCOPE": []byte(vartemplate.ScopeToken(schema.VariableReferenceSourceTypeProject, "KEY")),
	})
	suite.NoError(err)

	foreign := uuid.New()
	suite.svcRepo.EXPECT().GetByIDs(suite.ctx, []uuid.UUID{foreign}).Return(nil, nil).Once()
	err = suite.service.validateReferences(suite.ctx, userID, suite.target, map[string][]byte{
		"BAD": []byte(vartemplate.ServiceToken(foreign, "KEY")),
	})
	suite.ErrorContains(err, "not found in this project")
}

func (suite *RenderSuite) TestFindReferencingServices() {
	db := suite.newService("postgres", schema.ServiceTypeDatabase, utils.ToPtr("postgres"))
	consumer := suite.newService("consumer", schema.ServiceTypeGithub, nil)
	consumer.Edges.CurrentDeployment = &ent.Deployment{ID: uuid.New()}
	undeployed := suite.newService("undeployed", schema.ServiceTypeGithub, nil)
	unrelated := suite.newService("unrelated", schema.ServiceTypeGithub, nil)
	unrelated.Edges.CurrentDeployment = &ent.Deployment{ID: uuid.New()}

	suite.svcRepo.EXPECT().GetByID(suite.ctx, db.ID).Return(db, nil).Once()
	suite.svcRepo.EXPECT().GetByScope(suite.ctx, schema.VariableReferenceSourceTypeProject, suite.project.ID).
		Return([]*ent.Service{db, consumer, undeployed, unrelated}, nil).Once()
	suite.expectSecret(consumer.KubernetesSecret, map[string][]byte{"DSN": []byte(vartemplate.ServiceToken(db.ID, "DATABASE_URL"))})
	suite.expectSecret(unrelated.KubernetesSecret, map[string][]byte{"DSN": []byte(vartemplate.ServiceToken(db.ID, "DATABASE_HOST"))})

	services, err := suite.service.FindReferencingServices(suite.ctx, schema.VariableReferenceSourceTypeService, db.ID, []string{"DATABASE_URL", "DATABASE_PASSWORD"})
	suite.NoError(err)
	suite.Len(services, 1)
	suite.Equal(consumer.ID, services[0].ID)
}

func sortedIDs(ids ...uuid.UUID) []uuid.UUID {
	slices.SortFunc(ids, func(a, b uuid.UUID) int { return strings.Compare(a.String(), b.String()) })
	return ids
}

func TestRenderSuite(t *testing.T) {
	suite.Run(t, new(RenderSuite))
}
