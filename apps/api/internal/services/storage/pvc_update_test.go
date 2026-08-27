package storage_service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/services"
	"k8s.io/client-go/kubernetes"
)

type UpdatePVCSuite struct {
	services.ServiceTestSuite
	service *StorageService

	testUserID      uuid.UUID
	testTeamID      uuid.UUID
	testServiceID   uuid.UUID
	testTeam        *ent.Team
	testPVCID       string
	testBearerToken string
	mockK8sClient   *kubernetes.Clientset
}

func (suite *UpdatePVCSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()

	suite.service = &StorageService{
		repo: suite.MockRepo,
		k8s:  suite.MockK8s,
	}

	suite.testUserID = uuid.New()
	suite.testTeamID = uuid.New()
	suite.testServiceID = uuid.New()
	suite.testTeam = &ent.Team{
		ID:        suite.testTeamID,
		Namespace: "unbind-team",
	}
	suite.testPVCID = "meilisearch-data-2eo3i3bfm1zs"
	suite.testBearerToken = "test-token"
	suite.mockK8sClient = &kubernetes.Clientset{}
}

func (suite *UpdatePVCSuite) expectCommonReads(pvc *models.PVCInfo) {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.testUserID, mock.Anything).
		Return(nil).
		Once()

	suite.MockTeamRepo.EXPECT().
		GetByID(suite.Ctx, suite.testTeamID).
		Return(suite.testTeam, nil).
		Once()

	suite.MockK8s.EXPECT().
		CreateClientWithToken(suite.testBearerToken).
		Return(suite.mockK8sClient, nil).
		Once()

	suite.MockK8s.EXPECT().
		GetPersistentVolumeClaim(suite.Ctx, suite.testTeam.Namespace, suite.testPVCID, suite.mockK8sClient).
		Return(pvc, nil).
		Once()
}

func (suite *UpdatePVCSuite) TestRejectsEmptyInput() {
	input := &models.UpdatePVCInput{
		Type:   models.PvcScopeTeam,
		TeamID: suite.testTeamID,
		ID:     suite.testPVCID,
	}

	result, err := suite.service.UpdatePVC(suite.Ctx, suite.testUserID, suite.testBearerToken, input)

	suite.Nil(result)
	suite.ErrorContains(err, "Nothing to update")
}

func (suite *UpdatePVCSuite) TestRejectsShrink() {
	suite.expectCommonReads(&models.PVCInfo{
		ID:         suite.testPVCID,
		TeamID:     suite.testTeamID,
		CapacityGB: 10,
	})

	input := &models.UpdatePVCInput{
		Type:       models.PvcScopeTeam,
		TeamID:     suite.testTeamID,
		ID:         suite.testPVCID,
		CapacityGB: new(float64(5)),
	}

	result, err := suite.service.UpdatePVC(suite.Ctx, suite.testUserID, suite.testBearerToken, input)

	suite.Nil(result)
	suite.ErrorContains(err, "New size must be greater than existing size")
}

// A rename must be a pure metadata write: no service lookups, no database
// StatefulSet deletion, no PVC resize, no pod restarts — even when the volume
// is a mounted database volume. The strict mocks fail the test if any of
// those calls happen.
func (suite *UpdatePVCSuite) TestRenameOnlyDoesNotTouchKubernetes() {
	suite.expectCommonReads(&models.PVCInfo{
		ID:                 suite.testPVCID,
		TeamID:             suite.testTeamID,
		CapacityGB:         10,
		IsDatabase:         true,
		MountedOnServiceID: &suite.testServiceID,
	})

	newName := "Meilisearch Data"
	newDescription := "Primary search index"
	input := &models.UpdatePVCInput{
		Type:        models.PvcScopeTeam,
		TeamID:      suite.testTeamID,
		ID:          suite.testPVCID,
		Name:        &newName,
		Description: &newDescription,
	}

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		Run(func(ctx context.Context, fn func(repository.TxInterface) error) {
			mockTx := suite.NewTxMockTyped()

			suite.MockSystemRepo.EXPECT().
				UpsertPVCMetadata(suite.Ctx, mockTx, suite.testPVCID, &newName, &newDescription).
				Return(nil).
				Once()

			suite.MockSystemRepo.EXPECT().
				GetPVCMetadata(suite.Ctx, mockTx, []string{suite.testPVCID}).
				Return(map[string]*ent.PVCMetadata{
					suite.testPVCID: {Name: &newName, Description: &newDescription},
				}, nil).
				Once()

			suite.NoError(fn(mockTx))
		}).
		Return(nil).
		Once()

	result, err := suite.service.UpdatePVC(suite.Ctx, suite.testUserID, suite.testBearerToken, input)

	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(newName, result.Name)
	suite.Equal(&newDescription, result.Description)
}

// Sending the current size is not a resize — the update must skip the PVC
// patch and the rolling pod restart.
func (suite *UpdatePVCSuite) TestSameSizeSkipsResizeMachinery() {
	suite.expectCommonReads(&models.PVCInfo{
		ID:                 suite.testPVCID,
		TeamID:             suite.testTeamID,
		CapacityGB:         10,
		MountedOnServiceID: &suite.testServiceID,
	})

	input := &models.UpdatePVCInput{
		Type:       models.PvcScopeTeam,
		TeamID:     suite.testTeamID,
		ID:         suite.testPVCID,
		CapacityGB: new(float64(10)),
	}

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		Run(func(ctx context.Context, fn func(repository.TxInterface) error) {
			mockTx := suite.NewTxMockTyped()

			suite.MockSystemRepo.EXPECT().
				UpsertPVCMetadata(suite.Ctx, mockTx, suite.testPVCID, (*string)(nil), (*string)(nil)).
				Return(nil).
				Once()

			suite.MockSystemRepo.EXPECT().
				GetPVCMetadata(suite.Ctx, mockTx, []string{suite.testPVCID}).
				Return(map[string]*ent.PVCMetadata{}, nil).
				Once()

			suite.NoError(fn(mockTx))
		}).
		Return(nil).
		Once()

	result, err := suite.service.UpdatePVC(suite.Ctx, suite.testUserID, suite.testBearerToken, input)

	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(suite.testPVCID, result.Name)
}

// strict mocks fail this if the old operator dance (config write, STS orphaning, redeploy) runs
func (suite *UpdatePVCSuite) TestManagedDatabaseResizePatchesEveryReplicaClaim() {
	primary := "pgdata-my-db-abc123-0"
	suite.testPVCID = primary
	suite.expectCommonReads(&models.PVCInfo{
		ID:                 primary,
		TeamID:             suite.testTeamID,
		CapacityGB:         10,
		IsDatabase:         true,
		MountedOnServiceID: &suite.testServiceID,
	})

	dbType := "postgres"
	managed := &ent.Service{
		ID:             suite.testServiceID,
		Type:           schema.ServiceTypeDatabase,
		Name:           "My DB",
		KubernetesName: "my-db-abc123",
		Database:       &dbType,
	}
	managed.Edges.ServiceConfig = &ent.ServiceConfig{
		Replicas:       2,
		Volumes:        []schema.ServiceVolume{{ID: primary, MountPath: "/home/postgres/pgdata"}},
		DatabaseConfig: &schema.DatabaseConfig{StorageSize: "10Gi"},
	}

	suite.MockServiceRepo.EXPECT().
		GetByID(suite.Ctx, suite.testServiceID).
		Return(managed, nil).
		Once()

	for _, claim := range []string{primary, "pgdata-my-db-abc123-1"} {
		suite.MockK8s.EXPECT().
			UpdatePersistentVolumeClaim(suite.Ctx, suite.testTeam.Namespace, claim, mock.Anything, suite.mockK8sClient).
			Return(&models.PVCInfo{ID: claim, TeamID: suite.testTeamID, CapacityGB: 20}, nil).
			Once()
	}

	suite.MockK8s.EXPECT().
		RollingRestartPodsByLabel(suite.Ctx, suite.testTeam.Namespace, "unbind-service", suite.testServiceID.String(), suite.mockK8sClient).
		Return(nil).
		Once()

	suite.MockRepo.EXPECT().
		WithTx(suite.Ctx, mock.AnythingOfType("func(repository.TxInterface) error")).
		Run(func(ctx context.Context, fn func(repository.TxInterface) error) {
			mockTx := suite.NewTxMockTyped()

			suite.MockSystemRepo.EXPECT().
				UpsertPVCMetadata(suite.Ctx, mockTx, primary, (*string)(nil), (*string)(nil)).
				Return(nil).
				Once()

			suite.MockSystemRepo.EXPECT().
				GetPVCMetadata(suite.Ctx, mockTx, []string{primary}).
				Return(map[string]*ent.PVCMetadata{}, nil).
				Once()

			suite.NoError(fn(mockTx))
		}).
		Return(nil).
		Once()

	result, err := suite.service.UpdatePVC(suite.Ctx, suite.testUserID, suite.testBearerToken, &models.UpdatePVCInput{
		Type:       models.PvcScopeTeam,
		TeamID:     suite.testTeamID,
		ID:         primary,
		CapacityGB: new(float64(20)),
	})

	suite.NoError(err)
	suite.NotNil(result)
	suite.Equal(float64(20), result.CapacityGB)
}

func TestUpdatePVCSuite(t *testing.T) {
	suite.Run(t, new(UpdatePVCSuite))
}
