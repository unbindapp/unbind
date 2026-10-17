package system_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type NetworkSuite struct {
	repository.RepositoryBaseSuite
	systemRepo *SystemRepository
}

func (suite *NetworkSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.systemRepo = NewSystemRepository(suite.DB)
}

func (suite *NetworkSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.systemRepo = nil
}

func (suite *NetworkSuite) createService(name string) *ent.Service {
	team := suite.DB.Team.Create().SetKubernetesName(name).SetName(name).SetNamespace(name).SetKubernetesSecret(name).SaveX(suite.Ctx)
	project := suite.DB.Project.Create().SetKubernetesName(name).SetName(name).SetTeamID(team.ID).SetKubernetesSecret(name).SaveX(suite.Ctx)
	environment := suite.DB.Environment.Create().SetKubernetesName(name).SetName(name).SetProjectID(project.ID).SetKubernetesSecret(name).SaveX(suite.Ctx)
	return suite.DB.Service.Create().SetType(schema.ServiceTypeDockerimage).SetKubernetesName(name).SetName(name).SetEnvironmentID(environment.ID).SetKubernetesSecret(name).SaveX(suite.Ctx)
}

func (suite *NetworkSuite) TestExistsTellsAnySourceApartFromAService() {
	source := suite.createService("natricon")
	target := suite.createService("pippin")

	_, err := suite.systemRepo.CreateNetworkException(suite.Ctx, &source.ID, target.ID)
	suite.Require().NoError(err)

	exists, err := suite.systemRepo.NetworkExceptionExists(suite.Ctx, &source.ID, target.ID)
	suite.Require().NoError(err)
	suite.True(exists)

	exists, err = suite.systemRepo.NetworkExceptionExists(suite.Ctx, nil, target.ID)
	suite.Require().NoError(err)
	suite.False(exists)
}

func (suite *NetworkSuite) TestExceptionsCarryTheTeamOfBothServices() {
	source := suite.createService("natricon")
	target := suite.createService("pippin")

	created, err := suite.systemRepo.CreateNetworkException(suite.Ctx, &source.ID, target.ID)
	suite.Require().NoError(err)
	suite.Equal("natricon", created.Edges.SourceService.Edges.Environment.Edges.Project.Edges.Team.Namespace)
	suite.Equal("pippin", created.Edges.TargetService.Edges.Environment.Edges.Project.Edges.Team.Namespace)

	_, err = suite.systemRepo.CreateNetworkException(suite.Ctx, nil, target.ID)
	suite.Require().NoError(err)

	exceptions, err := suite.systemRepo.GetNetworkExceptions(suite.Ctx)
	suite.Require().NoError(err)
	suite.Len(exceptions, 2)
	suite.Nil(exceptions[1].Edges.SourceService)
}

func TestNetworkSuite(t *testing.T) {
	suite.Run(t, new(NetworkSuite))
}
