package system_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/pvcmetadata"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type PVCMetadataSuite struct {
	repository.RepositoryBaseSuite
	systemRepo *SystemRepository
}

func (suite *PVCMetadataSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.systemRepo = NewSystemRepository(suite.DB)
}

func (suite *PVCMetadataSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.systemRepo = nil
}

func (suite *PVCMetadataSuite) TestUpsertPVCMetadata() {
	suite.Run("Create New PVC Metadata", func() {
		err := suite.systemRepo.UpsertPVCMetadata(
			suite.Ctx, nil, "pvc-123",
			utils.ToPtr("Test PVC"),
			utils.ToPtr("Test description"),
		)
		suite.NoError(err)

		// Verify created
		metadata, err := suite.DB.PVCMetadata.Query().
			Where(pvcmetadata.PvcID("pvc-123")).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Equal("pvc-123", metadata.PvcID)
		suite.Equal("Test PVC", *metadata.Name)
		suite.Equal("Test description", *metadata.Description)
	})

	suite.Run("Update Existing PVC Metadata", func() {
		// Create initial metadata
		err := suite.systemRepo.UpsertPVCMetadata(
			suite.Ctx, nil, "pvc-456",
			utils.ToPtr("Initial Name"),
			utils.ToPtr("Initial description"),
		)
		suite.NoError(err)

		// Update
		err = suite.systemRepo.UpsertPVCMetadata(
			suite.Ctx, nil, "pvc-456",
			utils.ToPtr("Updated Name"),
			utils.ToPtr("Updated description"),
		)
		suite.NoError(err)

		// Verify updated
		metadata, err := suite.DB.PVCMetadata.Query().
			Where(pvcmetadata.PvcID("pvc-456")).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Equal("Updated Name", *metadata.Name)
		suite.Equal("Updated description", *metadata.Description)
	})

	suite.Run("Clear Fields", func() {
		// Create with data
		err := suite.systemRepo.UpsertPVCMetadata(
			suite.Ctx, nil, "pvc-789",
			utils.ToPtr("Name to clear"),
			utils.ToPtr("Description to clear"),
		)
		suite.NoError(err)

		// Clear fields
		err = suite.systemRepo.UpsertPVCMetadata(
			suite.Ctx, nil, "pvc-789",
			utils.ToPtr(""),
			utils.ToPtr(""),
		)
		suite.NoError(err)

		// Verify cleared
		metadata, err := suite.DB.PVCMetadata.Query().
			Where(pvcmetadata.PvcID("pvc-789")).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Nil(metadata.Name)
		suite.Nil(metadata.Description)
	})

	suite.Run("Partial Update", func() {
		// Create initial
		err := suite.systemRepo.UpsertPVCMetadata(
			suite.Ctx, nil, "pvc-partial",
			utils.ToPtr("Original Name"),
			utils.ToPtr("Original description"),
		)
		suite.NoError(err)

		// Update only name
		err = suite.systemRepo.UpsertPVCMetadata(
			suite.Ctx, nil, "pvc-partial",
			utils.ToPtr("New Name"),
			nil,
		)
		suite.NoError(err)

		// Verify
		metadata, err := suite.DB.PVCMetadata.Query().
			Where(pvcmetadata.PvcID("pvc-partial")).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Equal("New Name", *metadata.Name)
		suite.Equal("Original description", *metadata.Description)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		err := suite.systemRepo.UpsertPVCMetadata(
			suite.Ctx, nil, "pvc-error",
			utils.ToPtr("Name"),
			utils.ToPtr("Description"),
		)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *PVCMetadataSuite) TestGetPVCMetadata() {
	suite.Run("Get Multiple PVCs", func() {
		// Create test data
		suite.systemRepo.UpsertPVCMetadata(suite.Ctx, nil, "pvc-1", utils.ToPtr("PVC 1"), utils.ToPtr("Description 1"))
		suite.systemRepo.UpsertPVCMetadata(suite.Ctx, nil, "pvc-2", utils.ToPtr("PVC 2"), utils.ToPtr("Description 2"))
		suite.systemRepo.UpsertPVCMetadata(suite.Ctx, nil, "pvc-3", utils.ToPtr("PVC 3"), nil)

		result, err := suite.systemRepo.GetPVCMetadata(suite.Ctx, nil, []string{"pvc-1", "pvc-2", "pvc-3"})
		suite.NoError(err)
		suite.Len(result, 3)

		suite.Equal("PVC 1", *result["pvc-1"].Name)
		suite.Equal("PVC 2", *result["pvc-2"].Name)
		suite.Equal("PVC 3", *result["pvc-3"].Name)
		suite.Nil(result["pvc-3"].Description)
	})

	suite.Run("Get Subset", func() {
		result, err := suite.systemRepo.GetPVCMetadata(suite.Ctx, nil, []string{"pvc-1", "non-existent"})
		suite.NoError(err)
		suite.Len(result, 1)
		suite.Contains(result, "pvc-1")
		suite.NotContains(result, "non-existent")
	})

	suite.Run("Get Empty List", func() {
		result, err := suite.systemRepo.GetPVCMetadata(suite.Ctx, nil, []string{})
		suite.NoError(err)
		suite.Len(result, 0)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.systemRepo.GetPVCMetadata(suite.Ctx, nil, []string{"pvc-1"})
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *PVCMetadataSuite) TestDeletePVCMetadata() {
	suite.Run("Delete Existing", func() {
		// Create metadata
		suite.systemRepo.UpsertPVCMetadata(suite.Ctx, nil, "pvc-delete", utils.ToPtr("To Delete"), nil)

		err := suite.systemRepo.DeletePVCMetadata(suite.Ctx, nil, "pvc-delete")
		suite.NoError(err)

		// Verify deleted
		_, err = suite.DB.PVCMetadata.Query().
			Where(pvcmetadata.PvcID("pvc-delete")).
			Only(suite.Ctx)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Delete Non-existent", func() {
		err := suite.systemRepo.DeletePVCMetadata(suite.Ctx, nil, "non-existent")
		suite.NoError(err) // Should not error
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		err := suite.systemRepo.DeletePVCMetadata(suite.Ctx, nil, "pvc-delete")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestPVCMetadataSuite(t *testing.T) {
	suite.Run(t, new(PVCMetadataSuite))
}
