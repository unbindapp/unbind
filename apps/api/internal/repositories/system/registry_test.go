package system_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type RegistrySuite struct {
	repository.RepositoryBaseSuite
	systemRepo *SystemRepository
}

func (suite *RegistrySuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.systemRepo = NewSystemRepository(suite.DB)
}

func (suite *RegistrySuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.systemRepo = nil
}

func (suite *RegistrySuite) TestCreateRegistry() {
	suite.Run("Create Success", func() {
		reg, err := suite.systemRepo.CreateRegistry(
			suite.Ctx, nil,
			"registry.example.com",
			"registry-secret",
			true,
		)

		suite.NoError(err)
		suite.NotNil(reg)
		suite.Equal("registry.example.com", reg.Host)
		suite.Equal("registry-secret", reg.KubernetesSecret)
		suite.True(reg.IsDefault)
	})

	suite.Run("Create Non-default", func() {
		reg, err := suite.systemRepo.CreateRegistry(
			suite.Ctx, nil,
			"private.registry.com",
			"private-secret",
			false,
		)

		suite.NoError(err)
		suite.NotNil(reg)
		suite.False(reg.IsDefault)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.systemRepo.CreateRegistry(
			suite.Ctx, nil,
			"test.registry.com",
			"test-secret",
			false,
		)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *RegistrySuite) TestGetDefaultRegistry() {
	suite.Run("Get Default Success", func() {
		// Create default registry
		created, err := suite.systemRepo.CreateRegistry(
			suite.Ctx, nil,
			"default.registry.com",
			"default-secret",
			true,
		)
		suite.NoError(err)

		// Get default
		reg, err := suite.systemRepo.GetDefaultRegistry(suite.Ctx)
		suite.NoError(err)
		suite.NotNil(reg)
		suite.Equal(created.ID, reg.ID)
		suite.True(reg.IsDefault)
	})

	suite.Run("No Default Registry", func() {
		// Reset
		suite.DB.Registry.Delete().ExecX(suite.Ctx)
		_, err := suite.systemRepo.GetDefaultRegistry(suite.Ctx)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.systemRepo.GetDefaultRegistry(suite.Ctx)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *RegistrySuite) TestSetDefaultRegistry() {
	suite.Run("Set Default Success", func() {
		// Create registries
		reg1, err := suite.systemRepo.CreateRegistry(suite.Ctx, nil, "reg1.com", "secret1", true)
		suite.NoError(err)
		reg2, err := suite.systemRepo.CreateRegistry(suite.Ctx, nil, "reg2.com", "secret2", false)
		suite.NoError(err)

		// Set reg2 as default
		updated, err := suite.systemRepo.SetDefaultRegistry(suite.Ctx, reg2.ID)
		suite.NoError(err)
		suite.NotNil(updated)
		suite.True(updated.IsDefault)

		// Verify reg1 is no longer default
		reg1Updated, err := suite.DB.Registry.Get(suite.Ctx, reg1.ID)
		suite.NoError(err)
		suite.False(reg1Updated.IsDefault)
	})

	suite.Run("Set Default Non-existent", func() {
		_, err := suite.systemRepo.SetDefaultRegistry(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.systemRepo.SetDefaultRegistry(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *RegistrySuite) TestGetImagePullSecrets() {
	suite.Run("Get Secrets Success", func() {
		// Create registries
		suite.systemRepo.CreateRegistry(suite.Ctx, nil, "reg1.com", "secret1", true)
		suite.systemRepo.CreateRegistry(suite.Ctx, nil, "reg2.com", "secret2", false)
		suite.systemRepo.CreateRegistry(suite.Ctx, nil, "reg3.com", "secret3", false)

		secrets, err := suite.systemRepo.GetImagePullSecrets(suite.Ctx)
		suite.NoError(err)
		suite.Len(secrets, 3)
		suite.Contains(secrets, "secret1")
		suite.Contains(secrets, "secret2")
		suite.Contains(secrets, "secret3")
	})

	suite.Run("No Registries", func() {
		// Reset
		suite.DB.Registry.Delete().ExecX(suite.Ctx)
		secrets, err := suite.systemRepo.GetImagePullSecrets(suite.Ctx)
		suite.NoError(err)
		suite.Len(secrets, 0)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.systemRepo.GetImagePullSecrets(suite.Ctx)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *RegistrySuite) TestGetRegistry() {
	suite.Run("Get Success", func() {
		created, err := suite.systemRepo.CreateRegistry(
			suite.Ctx, nil,
			"get.registry.com",
			"get-secret",
			false,
		)
		suite.NoError(err)

		reg, err := suite.systemRepo.GetRegistry(suite.Ctx, created.ID)
		suite.NoError(err)
		suite.NotNil(reg)
		suite.Equal(created.ID, reg.ID)
		suite.Equal("get.registry.com", reg.Host)
	})

	suite.Run("Get Non-existent", func() {
		_, err := suite.systemRepo.GetRegistry(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.systemRepo.GetRegistry(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *RegistrySuite) TestGetAllRegistries() {
	suite.Run("Get All Success", func() {
		// Create registries
		suite.systemRepo.CreateRegistry(suite.Ctx, nil, "reg1.com", "secret1", true)
		suite.systemRepo.CreateRegistry(suite.Ctx, nil, "reg2.com", "secret2", false)

		registries, err := suite.systemRepo.GetAllRegistries(suite.Ctx)
		suite.NoError(err)
		suite.GreaterOrEqual(len(registries), 2)

		// Check ordering (most recent first)
		if len(registries) >= 2 {
			suite.True(registries[0].CreatedAt.After(registries[1].CreatedAt) ||
				registries[0].CreatedAt.Equal(registries[1].CreatedAt))
		}
	})

	suite.Run("No Registries", func() {
		// Reset
		suite.DB.Registry.Delete().ExecX(suite.Ctx)
		registries, err := suite.systemRepo.GetAllRegistries(suite.Ctx)
		suite.NoError(err)
		suite.Len(registries, 0)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.systemRepo.GetAllRegistries(suite.Ctx)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *RegistrySuite) TestDeleteRegistry() {
	suite.Run("Delete Success", func() {
		created, err := suite.systemRepo.CreateRegistry(
			suite.Ctx, nil,
			"delete.registry.com",
			"delete-secret",
			false,
		)
		suite.NoError(err)

		err = suite.systemRepo.DeleteRegistry(suite.Ctx, created.ID)
		suite.NoError(err)

		// Verify deleted
		_, err = suite.DB.Registry.Get(suite.Ctx, created.ID)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Delete Non-existent", func() {
		err := suite.systemRepo.DeleteRegistry(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		err := suite.systemRepo.DeleteRegistry(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestRegistrySuite(t *testing.T) {
	suite.Run(t, new(RegistrySuite))
}
