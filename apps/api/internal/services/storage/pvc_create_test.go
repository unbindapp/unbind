package storage_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/services"
	"k8s.io/client-go/kubernetes"
)

type CreatePVCSuite struct {
	services.ServiceTestSuite
	service *StorageService

	testUserID        uuid.UUID
	testTeamID        uuid.UUID
	testProjectID     uuid.UUID
	testEnvironmentID uuid.UUID
	testServiceID     uuid.UUID
	mockK8sClient     *kubernetes.Clientset
}

func (suite *CreatePVCSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()

	suite.service = &StorageService{
		repo: suite.MockRepo,
		k8s:  suite.MockK8s,
	}

	suite.testUserID = uuid.New()
	suite.testTeamID = uuid.New()
	suite.testProjectID = uuid.New()
	suite.testEnvironmentID = uuid.New()
	suite.testServiceID = uuid.New()
	suite.mockK8sClient = &kubernetes.Clientset{}
}

func (suite *CreatePVCSuite) attachInput(mountPath string) *models.CreatePVCInput {
	return &models.CreatePVCInput{
		Type:          models.PvcScopeEnvironment,
		Name:          "data",
		TeamID:        suite.testTeamID,
		ProjectID:     suite.testProjectID,
		EnvironmentID: suite.testEnvironmentID,
		CapacityGB:    1,
		ServiceID:     &suite.testServiceID,
		MountPath:     &mountPath,
	}
}

func (suite *CreatePVCSuite) expectScopeReads() {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.Anything).
		Return(nil).
		Once()
	suite.MockTeamRepo.EXPECT().
		GetByID(suite.Ctx, suite.testTeamID).
		Return(&ent.Team{ID: suite.testTeamID, Namespace: "unbind-team"}, nil).
		Once()
	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(&ent.Project{ID: suite.testProjectID, TeamID: suite.testTeamID}, nil).
		Once()
	suite.MockEnvironmentRepo.EXPECT().
		GetByID(suite.Ctx, suite.testEnvironmentID).
		Return(&ent.Environment{ID: suite.testEnvironmentID, ProjectID: suite.testProjectID}, nil).
		Once()
	suite.MockK8s.EXPECT().
		GetInternalClient().
		Return(suite.mockK8sClient)
}

func (suite *CreatePVCSuite) expectServiceRead(service *ent.Service) {
	suite.MockServiceRepo.EXPECT().
		GetByID(suite.Ctx, suite.testServiceID).
		Return(service, nil).
		Once()
}

func (suite *CreatePVCSuite) assertInvalidInput(err error) {
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
}

func (suite *CreatePVCSuite) TestRejectsServiceWithoutMountPath() {
	input := suite.attachInput("/data")
	input.MountPath = nil

	result, err := suite.service.CreatePVC(suite.Ctx, suite.testUserID, input)

	suite.Nil(result)
	suite.assertInvalidInput(err)
}

func (suite *CreatePVCSuite) TestRejectsMountPathWithoutService() {
	input := suite.attachInput("/data")
	input.ServiceID = nil

	result, err := suite.service.CreatePVC(suite.Ctx, suite.testUserID, input)

	suite.Nil(result)
	suite.assertInvalidInput(err)
}

func (suite *CreatePVCSuite) TestRejectsAttachOutsideEnvironmentScope() {
	input := suite.attachInput("/data")
	input.Type = models.PvcScopeProject

	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.Anything).
		Return(nil).
		Once()
	suite.MockTeamRepo.EXPECT().
		GetByID(suite.Ctx, suite.testTeamID).
		Return(&ent.Team{ID: suite.testTeamID, Namespace: "unbind-team"}, nil).
		Once()
	suite.MockProjectRepo.EXPECT().
		GetByID(suite.Ctx, suite.testProjectID).
		Return(&ent.Project{ID: suite.testProjectID, TeamID: suite.testTeamID}, nil).
		Once()
	suite.MockK8s.EXPECT().
		GetInternalClient().
		Return(suite.mockK8sClient)

	result, err := suite.service.CreatePVC(suite.Ctx, suite.testUserID, input)

	suite.Nil(result)
	suite.assertInvalidInput(err)
}

func (suite *CreatePVCSuite) TestRejectsInvalidMountPath() {
	for _, path := range []string{"data", "/data//logs", "C:\\data", ""} {
		suite.Run(path, func() {
			suite.SetupTest()
			suite.expectScopeReads()

			result, err := suite.service.CreatePVC(suite.Ctx, suite.testUserID, suite.attachInput(path))

			suite.Nil(result)
			suite.assertInvalidInput(err)
		})
	}
}

func (suite *CreatePVCSuite) TestRejectsServiceInAnotherEnvironment() {
	suite.expectScopeReads()
	suite.expectServiceRead(&ent.Service{
		ID:            suite.testServiceID,
		EnvironmentID: uuid.New(),
		Type:          schema.ServiceTypeDockerimage,
	})

	result, err := suite.service.CreatePVC(suite.Ctx, suite.testUserID, suite.attachInput("/data"))

	suite.Nil(result)
	suite.ErrorIs(err, errdefs.ErrNotFound)
}

func (suite *CreatePVCSuite) TestRejectsDatabaseService() {
	suite.expectScopeReads()
	suite.expectServiceRead(&ent.Service{
		ID:            suite.testServiceID,
		EnvironmentID: suite.testEnvironmentID,
		Type:          schema.ServiceTypeDatabase,
	})

	result, err := suite.service.CreatePVC(suite.Ctx, suite.testUserID, suite.attachInput("/data"))

	suite.Nil(result)
	suite.assertInvalidInput(err)
}

func (suite *CreatePVCSuite) TestRejectsServiceWithExistingVolume() {
	suite.expectScopeReads()
	service := &ent.Service{
		ID:            suite.testServiceID,
		EnvironmentID: suite.testEnvironmentID,
		Type:          schema.ServiceTypeDockerimage,
	}
	service.Edges.ServiceConfig = &ent.ServiceConfig{
		Volumes: []schema.ServiceVolume{{ID: "existing-volume", MountPath: "/data"}},
	}
	suite.expectServiceRead(service)

	result, err := suite.service.CreatePVC(suite.Ctx, suite.testUserID, suite.attachInput("/other"))

	suite.Nil(result)
	suite.assertInvalidInput(err)
}

func TestCreatePVCSuite(t *testing.T) {
	suite.Run(t, new(CreatePVCSuite))
}
