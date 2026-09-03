package variable_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type VariableRepositorySuite struct {
	repository.RepositoryBaseSuite
	variableRepo *VariableRepository
	testService  *ent.Service
}

func (suite *VariableRepositorySuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.variableRepo = NewVariableRepository(suite.DB)

	team := suite.DB.Team.Create().
		SetKubernetesName("test-team").
		SetName("Test Team").
		SetNamespace("test-namespace").
		SetKubernetesSecret("test-k8s-secret").
		SaveX(suite.Ctx)
	project := suite.DB.Project.Create().
		SetKubernetesName("test-project").
		SetName("Test Project").
		SetTeamID(team.ID).
		SetKubernetesSecret("test-project-secret").
		SaveX(suite.Ctx)
	environment := suite.DB.Environment.Create().
		SetKubernetesName("test-env").
		SetName("Test Environment").
		SetProjectID(project.ID).
		SetKubernetesSecret("test-env-secret").
		SaveX(suite.Ctx)
	suite.testService = suite.DB.Service.Create().
		SetType(schema.ServiceTypeGithub).
		SetKubernetesName("test-service").
		SetName("Test Service").
		SetEnvironmentID(environment.ID).
		SetKubernetesSecret("test-service-secret").
		SaveX(suite.Ctx)
}

func (suite *VariableRepositorySuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.variableRepo = nil
	suite.testService = nil
}

func (suite *VariableRepositorySuite) createReference(name string) *ent.VariableReference {
	return suite.DB.VariableReference.Create().
		SetTargetServiceID(suite.testService.ID).
		SetTargetName(name).
		SetSources([]schema.VariableReferenceSource{}).
		SetValueTemplate("${api.KEY}").
		SaveX(suite.Ctx)
}

func (suite *VariableRepositorySuite) TestUnmigratedReferencesAndMarkMigrated() {
	first := suite.createReference("FIRST")
	second := suite.createReference("SECOND")

	references, err := suite.variableRepo.GetUnmigratedReferences(suite.Ctx)
	suite.NoError(err)
	suite.Len(references, 2)
	suite.Equal(first.ID, references[0].ID)
	suite.Equal(second.ID, references[1].ID)

	suite.NoError(suite.variableRepo.MarkReferenceMigrated(suite.Ctx, first.ID))

	references, err = suite.variableRepo.GetUnmigratedReferences(suite.Ctx)
	suite.NoError(err)
	suite.Len(references, 1)
	suite.Equal(second.ID, references[0].ID)

	migrated := suite.DB.VariableReference.GetX(suite.Ctx, first.ID)
	suite.NotNil(migrated.MigratedAt)
}

func TestVariableRepositorySuite(t *testing.T) {
	suite.Run(t, new(VariableRepositorySuite))
}
