package deployments_service

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	"github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

type CreateCRDFromServiceSuite struct {
	repositorytest.RepositoryBaseSuite
	deploymentService *DeploymentService
	bucket            *ent.S3Bucket
	service           *ent.Service
	config            *ent.ServiceConfig
}

func (suite *CreateCRDFromServiceSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.deploymentService = NewDeploymentService(repositories.NewRepositories(suite.DB), nil, nil, nil, nil, nil, nil)

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
	environment := suite.DB.Environment.Create().
		SetKubernetesName("env").
		SetName("Env").
		SetProjectID(project.ID).
		SetKubernetesSecret("env-secret").
		SaveX(suite.Ctx)
	suite.bucket = suite.DB.S3Bucket.Create().
		SetName("backups").
		SetEndpoint("https://s3.example.com").
		SetRegion("us-east-1").
		SetBucket("db-backups").
		SetKubernetesSecret("backups-secret").
		SetTeamID(team.ID).
		SaveX(suite.Ctx)
	suite.service = suite.DB.Service.Create().
		SetType(schema.ServiceTypeDatabase).
		SetKubernetesName("postgres").
		SetName("Postgres").
		SetDatabase("postgres").
		SetEnvironmentID(environment.ID).
		SetKubernetesSecret("service-secret").
		SaveX(suite.Ctx)
	suite.config = suite.DB.ServiceConfig.Create().
		SetServiceID(suite.service.ID).
		SetBuilder(schema.ServiceBuilderDatabase).
		SetIcon("postgres").
		SetReplicas(1).
		SetDatabaseConfig(&schema.DatabaseConfig{StorageSize: "1Gi"}).
		SaveX(suite.Ctx)
}

func (suite *CreateCRDFromServiceSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.deploymentService = nil
	suite.bucket = nil
	suite.service = nil
	suite.config = nil
}

func (suite *CreateCRDFromServiceSuite) deployedService(backupConfig *v1.S3ConfigSpec) *ent.Service {
	deployment := suite.DB.Deployment.Create().
		SetServiceID(suite.service.ID).
		SetStatus(schema.DeploymentStatusBuildSucceeded).
		SetSource(schema.DeploymentSourceManual).
		SetBuilder(schema.ServiceBuilderDatabase).
		SetResourceDefinition(&v1.Service{
			Spec: v1.ServiceSpec{
				Builder: "database",
				Config: v1.ServiceConfigSpec{
					Replicas: utils.ToPtr[int32](1),
					Database: v1.DatabaseSpec{
						Type:                "postgres",
						DatabaseSpecVersion: "1.0.0",
						S3BackupConfig:      backupConfig,
					},
				},
			},
		}).
		SaveX(suite.Ctx)
	suite.DB.Service.UpdateOneID(suite.service.ID).SetCurrentDeploymentID(deployment.ID).SaveX(suite.Ctx)

	service, err := suite.DB.Service.Query().
		WithServiceConfig().
		WithCurrentDeployment().
		Only(suite.Ctx)
	suite.NoError(err)
	return service
}

func (suite *CreateCRDFromServiceSuite) TestBucketAssignedAfterDeploy() {
	suite.DB.ServiceConfig.UpdateOneID(suite.config.ID).
		SetS3BackupBucketID(suite.bucket.ID).
		SetBackupSchedule("0 3 * * *").
		SetBackupRetentionCount(7).
		SaveX(suite.Ctx)

	crd, err := suite.deploymentService.CreateCRDFromService(suite.Ctx, suite.deployedService(nil))
	suite.NoError(err)
	suite.Equal(&v1.S3ConfigSpec{
		Bucket:               "db-backups",
		Endpoint:             "https://s3.example.com",
		Region:               "us-east-1",
		SecretName:           "backups-secret",
		BackupSchedule:       "0 3 * * *",
		BackupRetentionCount: 7,
	}, crd.Spec.Config.Database.S3BackupConfig)
	suite.Equal("postgres", crd.Spec.Config.Database.Type)
	suite.Equal("1.0.0", crd.Spec.Config.Database.DatabaseSpecVersion)
}

func (suite *CreateCRDFromServiceSuite) TestBucketCleared() {
	deployed := &v1.S3ConfigSpec{Bucket: "db-backups", Endpoint: "https://s3.example.com", Region: "us-east-1", SecretName: "backups-secret"}

	crd, err := suite.deploymentService.CreateCRDFromService(suite.Ctx, suite.deployedService(deployed))
	suite.NoError(err)
	suite.Nil(crd.Spec.Config.Database.S3BackupConfig)
}

func TestCreateCRDFromServiceSuite(t *testing.T) {
	suite.Run(t, new(CreateCRDFromServiceSuite))
}
