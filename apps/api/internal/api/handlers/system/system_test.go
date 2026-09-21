package system_handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/infrastructure/buildkitd"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	system_service "github.com/unbindapp/unbind-api/internal/services/system"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

const systemNamespace = "unbind-system"

type SystemHandlerSuite struct {
	repository.RepositoryBaseSuite
	api       humatest.TestAPI
	clientset *k8sfake.Clientset
	actor     *ent.User
	editor    *ent.User
}

func (suite *SystemHandlerSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()

	repo := repositories.NewRepositories(suite.DB)
	cfg := &config.Config{SystemNamespace: systemNamespace}
	suite.clientset = k8sfake.NewClientset()
	kube := mocks_infrastructure_k8s.NewKubeClientMock(suite.T())
	kube.EXPECT().GetInternalClient().Return(suite.clientset).Maybe()
	buildkit := buildkitd.NewBuildkitSettingsManager(cfg, repo, kube)

	srv := &server.Server{
		Repository:    repo,
		SystemService: system_service.NewSystemService(cfg, repo, buildkit, nil, nil, kube),
	}

	_, api := humatest.New(suite.T())
	grp := huma.NewGroup(api, "/system")
	grp.UseMiddleware(func(ctx huma.Context, next func(huma.Context)) {
		next(huma.WithValue(ctx, apictx.UserKey, suite.actor))
	})
	RegisterHandlers(srv, grp)
	suite.api = api

	suite.editor = suite.userWithGrant("editor@example.com", schema.ActionEditor, schema.ResourceTypeSystem)
	suite.actor = suite.editor
}

func (suite *SystemHandlerSuite) userWithGrant(email string, action schema.PermittedAction, resourceType schema.ResourceType) *ent.User {
	perm := suite.DB.Permission.Create().
		SetAction(action).
		SetResourceType(resourceType).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)
	group := suite.DB.Group.Create().SetName(email).AddPermissionIDs(perm.ID).SaveX(suite.Ctx)
	return suite.DB.User.Create().SetEmail(email).SetPasswordHash("x").AddGroupIDs(group.ID).SaveX(suite.Ctx)
}

func (suite *SystemHandlerSuite) seedServiceWithHost(host string) {
	team := suite.DB.Team.Create().
		SetKubernetesName("team").
		SetName("Team").
		SetNamespace("team").
		SetKubernetesSecret("team-secret").
		SaveX(suite.Ctx)
	project := suite.DB.Project.Create().
		SetKubernetesName("project").
		SetName("Project").
		SetTeamID(team.ID).
		SetKubernetesSecret("project-secret").
		SaveX(suite.Ctx)
	environment := suite.DB.Environment.Create().
		SetKubernetesName("env").
		SetName("Env").
		SetProjectID(project.ID).
		SetKubernetesSecret("env-secret").
		SaveX(suite.Ctx)
	service := suite.DB.Service.Create().
		SetType(schema.ServiceTypeDockerimage).
		SetKubernetesName("nginx").
		SetName("Nginx").
		SetEnvironmentID(environment.ID).
		SetKubernetesSecret("nginx-secret").
		SaveX(suite.Ctx)
	suite.DB.ServiceConfig.Create().
		SetServiceID(service.ID).
		SetBuilder(schema.ServiceBuilderDocker).
		SetIcon("docker").
		SetImage("nginx:1.27").
		SetHosts([]schema.HostSpec{{Host: host, TargetPort: new(int32(80))}}).
		SaveX(suite.Ctx)
}

func (suite *SystemHandlerSuite) checkUniqueDomain(query string) (int, *CollisionOutput) {
	resp := suite.api.Get("/system/domain/check" + query)
	if resp.Code != http.StatusOK {
		return resp.Code, nil
	}
	var out CheckUniqueDomainOutput
	suite.Require().NoError(json.Unmarshal(resp.Body.Bytes(), &out.Body), resp.Body.String())
	return resp.Code, out.Body.Data
}

func (suite *SystemHandlerSuite) updateSettings(body map[string]any) (int, *system_service.SystemSettingsResponse) {
	resp := suite.api.Put("/system/settings/update", body)
	if resp.Code != http.StatusOK {
		return resp.Code, nil
	}
	var out SettingsResponse
	suite.Require().NoError(json.Unmarshal(resp.Body.Bytes(), &out.Body), resp.Body.String())
	return resp.Code, out.Body.Data
}

func (suite *SystemHandlerSuite) TestCheckUniqueDomainReadsTheQueryParameter() {
	suite.seedServiceWithHost("taken.example.com")

	code, result := suite.checkUniqueDomain("?domain=taken.example.com")
	suite.Require().Equal(http.StatusOK, code)
	suite.False(result.IsUnique)

	code, result = suite.checkUniqueDomain("?domain=https://free.example.com/")
	suite.Require().Equal(http.StatusOK, code)
	suite.True(result.IsUnique)

	code, _ = suite.checkUniqueDomain("")
	suite.Equal(http.StatusUnprocessableEntity, code)

	code, _ = suite.checkUniqueDomain("?domain=nodots")
	suite.Equal(http.StatusBadRequest, code)
}

func (suite *SystemHandlerSuite) TestClearingWildcardDomainSkipsDNSValidation() {
	suite.DB.SystemSetting.Create().SetWildcardBaseURL("apps.example.com").SaveX(suite.Ctx)

	code, settings := suite.updateSettings(map[string]any{"wildcard_domain": ""})
	suite.Require().Equal(http.StatusOK, code)
	suite.Nil(settings.WildcardDomain)

	stored := suite.DB.SystemSetting.Query().OnlyX(suite.Ctx)
	suite.Nil(stored.WildcardBaseURL)
}

func (suite *SystemHandlerSuite) TestUpdateResponseReportsWhetherBuildkitIsUpdatable() {
	code, settings := suite.updateSettings(map[string]any{})
	suite.Require().Equal(http.StatusOK, code)
	suite.False(settings.CanUpdateBuildkit)

	_, err := suite.clientset.CoreV1().ConfigMaps(systemNamespace).Create(suite.Ctx, &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: buildkitd.BuildkitConfigName},
	}, metav1.CreateOptions{})
	suite.Require().NoError(err)

	code, settings = suite.updateSettings(map[string]any{})
	suite.Require().Equal(http.StatusOK, code)
	suite.True(settings.CanUpdateBuildkit)
}

func (suite *SystemHandlerSuite) TestUpdateSettingsIgnoresRegistryCacheSettings() {
	code, _ := suite.updateSettings(map[string]any{
		"registry_cache_settings": map[string]any{"cleanup_threshold_gb": 5},
	})
	suite.Equal(http.StatusUnprocessableEntity, code)
}

func TestSystemHandlerSuite(t *testing.T) {
	suite.Run(t, new(SystemHandlerSuite))
}
