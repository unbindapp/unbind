package service_repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type ServiceOrderSuite struct {
	repository.RepositoryBaseSuite
	serviceRepo *ServiceRepository
	env         *ent.Environment
	otherEnv    *ent.Environment
	created     time.Time
}

func (suite *ServiceOrderSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.serviceRepo = NewServiceRepository(suite.DB, nil)
	suite.created = time.Now().Add(-time.Hour)

	team := suite.DB.Team.Create().
		SetKubernetesName("team").
		SetName("Team").
		SetNamespace("team-ns").
		SetKubernetesSecret("team-secret").
		SaveX(suite.Ctx)
	project := suite.DB.Project.Create().
		SetKubernetesName("project").
		SetName("Project").
		SetTeamID(team.ID).
		SetKubernetesSecret("project-secret").
		SaveX(suite.Ctx)
	suite.env = suite.DB.Environment.Create().
		SetKubernetesName("env").
		SetName("Env").
		SetProjectID(project.ID).
		SetKubernetesSecret("env-secret").
		SaveX(suite.Ctx)
	suite.otherEnv = suite.DB.Environment.Create().
		SetKubernetesName("other-env").
		SetName("Other Env").
		SetProjectID(project.ID).
		SetKubernetesSecret("other-env-secret").
		SaveX(suite.Ctx)
}

// Each item is created a minute after the previous one
func (suite *ServiceOrderSuite) nextCreatedAt() time.Time {
	suite.created = suite.created.Add(time.Minute)
	return suite.created
}

func (suite *ServiceOrderSuite) group(name string, position int) *ent.ServiceGroup {
	return suite.DB.ServiceGroup.Create().
		SetName(name).
		SetEnvironmentID(suite.env.ID).
		SetPosition(position).
		SetCreatedAt(suite.nextCreatedAt()).
		SetUpdatedAt(suite.created).
		SaveX(suite.Ctx)
}

func (suite *ServiceOrderSuite) service(name string, position int, group *ent.ServiceGroup) *ent.Service {
	create := suite.DB.Service.Create().
		SetType(schema.ServiceTypeDockerimage).
		SetKubernetesName(name + "-k8s").
		SetName(name).
		SetEnvironmentID(suite.env.ID).
		SetKubernetesSecret(name + "-secret").
		SetPosition(position).
		SetCreatedAt(suite.nextCreatedAt()).
		SetUpdatedAt(suite.created)
	if group != nil {
		create.SetServiceGroupID(group.ID)
	}
	return create.SaveX(suite.Ctx)
}

func (suite *ServiceOrderSuite) listNames(sortField models.SortByField, sortOrder models.SortOrder) []string {
	services := suite.DB.Service.Query().
		Where(service.EnvironmentID(suite.env.ID)).
		WithServiceGroup().
		AllX(suite.Ctx)
	SortServices(services, sortField, sortOrder)
	names := make([]string, len(services))
	for i, s := range services {
		names[i] = s.Name
	}
	return names
}

func (suite *ServiceOrderSuite) TestCustomKeepsGroupsTogether() {
	g := suite.group("group", 1)
	suite.service("web", 0, nil)
	suite.service("db", 1, g)
	suite.service("cache", 0, g)
	suite.service("worker", 2, nil)

	suite.Equal([]string{"web", "cache", "db", "worker"}, suite.listNames(models.SortByCustom, ""))
	suite.Equal([]string{"worker", "db", "cache", "web"}, suite.listNames(models.SortByCustom, models.SortOrderDesc))
}

func (suite *ServiceOrderSuite) TestCustomTiePutsNewerFirst() {
	g := suite.group("group", 0)
	suite.service("old", 0, nil)
	suite.service("a", 0, g)
	suite.service("b", 0, g)
	suite.service("new", 0, nil)

	suite.Equal([]string{"new", "old", "b", "a"}, suite.listNames(models.SortByCustom, ""))
}

func (suite *ServiceOrderSuite) TestOtherSortsAreFlat() {
	g := suite.group("group", 0)
	suite.service("b", 0, g)
	suite.service("c", 0, nil)
	suite.service("a", 0, g)
	suite.service("B2", 0, nil)

	suite.Equal([]string{"a", "b", "B2", "c"}, suite.listNames(models.SortByName, ""))
	suite.Equal([]string{"B2", "a", "c", "b"}, suite.listNames(models.SortByCreatedAt, ""))
	suite.Equal([]string{"b", "c", "a", "B2"}, suite.listNames(models.SortByCreatedAt, models.SortOrderAsc))
}

func (suite *ServiceOrderSuite) TestCreatePutsServicesFirstInTheirLevel() {
	g := suite.group("group", -2)
	suite.service("top", 3, nil)
	suite.service("in-group", 5, g)

	ungrouped, err := suite.serviceRepo.Create(suite.Ctx, nil, &CreateServiceInput{
		KubernetesName: "new-k8s", Name: "new", ServiceType: schema.ServiceTypeDockerimage,
		EnvironmentID: suite.env.ID, KubernetesSecret: "new-secret",
	})
	suite.Require().NoError(err)
	suite.Equal(-3, ungrouped.Position)

	grouped, err := suite.serviceRepo.Create(suite.Ctx, nil, &CreateServiceInput{
		KubernetesName: "new-grouped-k8s", Name: "new-grouped", ServiceType: schema.ServiceTypeDockerimage,
		EnvironmentID: suite.env.ID, KubernetesSecret: "new-grouped-secret", ServiceGroupID: &g.ID,
	})
	suite.Require().NoError(err)
	suite.Equal(4, grouped.Position)
}

func (suite *ServiceOrderSuite) TestReorderEnvironment() {
	g := suite.group("group", 0)
	web := suite.service("web", 1, nil)
	suite.service("db", 0, g)
	worker := suite.service("worker", 2, nil)

	err := suite.serviceRepo.ReorderEnvironment(suite.Ctx, nil, suite.env.ID, []uuid.UUID{worker.ID, g.ID, web.ID})
	suite.NoError(err)
	suite.Equal([]string{"worker", "db", "web"}, suite.listNames(models.SortByCustom, ""))
}

func (suite *ServiceOrderSuite) TestReorderEnvironmentKeepsUnlistedInOrderAndUpdatedAt() {
	a := suite.service("a", 0, nil)
	suite.service("b", 1, nil)
	c := suite.service("c", 2, nil)

	err := suite.serviceRepo.ReorderEnvironment(suite.Ctx, nil, suite.env.ID, []uuid.UUID{c.ID})
	suite.NoError(err)
	suite.Equal([]string{"c", "a", "b"}, suite.listNames(models.SortByCustom, ""))
	suite.True(a.UpdatedAt.Equal(suite.DB.Service.GetX(suite.Ctx, a.ID).UpdatedAt))
}

func (suite *ServiceOrderSuite) TestReorderEnvironmentRejectsGroupedAndForeignServices() {
	g := suite.group("group", 0)
	grouped := suite.service("grouped", 0, g)
	foreign := suite.DB.Service.Create().
		SetType(schema.ServiceTypeDockerimage).
		SetKubernetesName("foreign-k8s").
		SetName("foreign").
		SetEnvironmentID(suite.otherEnv.ID).
		SetKubernetesSecret("foreign-secret").
		SaveX(suite.Ctx)

	err := suite.serviceRepo.ReorderEnvironment(suite.Ctx, nil, suite.env.ID, []uuid.UUID{grouped.ID})
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
	err = suite.serviceRepo.ReorderEnvironment(suite.Ctx, nil, suite.env.ID, []uuid.UUID{foreign.ID})
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
	err = suite.serviceRepo.ReorderEnvironment(suite.Ctx, nil, suite.env.ID, []uuid.UUID{g.ID, g.ID})
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
}

func (suite *ServiceOrderSuite) TestReorderGroup() {
	g := suite.group("group", 0)
	a := suite.service("a", 0, g)
	b := suite.service("b", 1, g)
	c := suite.service("c", 2, g)
	ungrouped := suite.service("ungrouped", 1, nil)

	err := suite.serviceRepo.ReorderGroup(suite.Ctx, nil, g.ID, []uuid.UUID{c.ID, a.ID, b.ID})
	suite.NoError(err)
	suite.Equal([]string{"c", "a", "b", "ungrouped"}, suite.listNames(models.SortByCustom, ""))

	err = suite.serviceRepo.ReorderGroup(suite.Ctx, nil, g.ID, []uuid.UUID{ungrouped.ID})
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
}

func TestServiceOrderSuite(t *testing.T) {
	suite.Run(t, new(ServiceOrderSuite))
}
