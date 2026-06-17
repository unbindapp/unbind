package bootstrap_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type BootstrapQueriesSuite struct {
	repository.RepositoryBaseSuite
	bootstrapRepo *BootstrapRepository
	testGroup     *ent.Group
}

func (suite *BootstrapQueriesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.bootstrapRepo = NewBootstrapRepository(suite.DB)

	// Create a test group
	suite.testGroup = suite.DB.Group.Create().
		SetName("test-group").
		SetK8sRoleName("test-role").
		SaveX(suite.Ctx)
}

func (suite *BootstrapQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.bootstrapRepo = nil
	suite.testGroup = nil
}

func (suite *BootstrapQueriesSuite) TestIsBootstrapped() {
	suite.Run("IsBootstrapped No Users No Bootstrap", func() {
		// Clean up any existing data
		suite.DB.User.Delete().ExecX(suite.Ctx)
		suite.DB.Bootstrap.Delete().ExecX(suite.Ctx)

		userExists, isBootstrapped, err := suite.bootstrapRepo.IsBootstrapped(suite.Ctx, nil)
		suite.NoError(err)
		suite.False(userExists)
		suite.False(isBootstrapped)
	})

	suite.Run("IsBootstrapped Users Exist No Bootstrap Row", func() {
		// Clean up any existing data
		suite.DB.User.Delete().ExecX(suite.Ctx)
		suite.DB.Bootstrap.Delete().ExecX(suite.Ctx)

		// Create a user
		suite.DB.User.Create().
			SetEmail("test@example.com").
			SetPasswordHash("hash").
			SaveX(suite.Ctx)

		// A user existing implies bootstrap completed, even without a Bootstrap row.
		userExists, isBootstrapped, err := suite.bootstrapRepo.IsBootstrapped(suite.Ctx, nil)
		suite.NoError(err)
		suite.True(userExists)
		suite.True(isBootstrapped)
	})

	suite.Run("IsBootstrapped No Users But Bootstrap Flag Set", func() {
		// Clean up any existing data
		suite.DB.User.Delete().ExecX(suite.Ctx)
		suite.DB.Bootstrap.Delete().ExecX(suite.Ctx)

		// Set bootstrap flag
		suite.DB.Bootstrap.Create().
			SetIsBootstrapped(true).
			SaveX(suite.Ctx)

		userExists, isBootstrapped, err := suite.bootstrapRepo.IsBootstrapped(suite.Ctx, nil)
		suite.NoError(err)
		suite.False(userExists)
		suite.True(isBootstrapped)
	})

	suite.Run("IsBootstrapped Users Exist And Bootstrap Flag Set", func() {
		// Clean up any existing data
		suite.DB.User.Delete().ExecX(suite.Ctx)
		suite.DB.Bootstrap.Delete().ExecX(suite.Ctx)

		// Create a user
		suite.DB.User.Create().
			SetEmail("test2@example.com").
			SetPasswordHash("hash").
			SaveX(suite.Ctx)

		// Set bootstrap flag
		suite.DB.Bootstrap.Create().
			SetIsBootstrapped(true).
			SaveX(suite.Ctx)

		userExists, isBootstrapped, err := suite.bootstrapRepo.IsBootstrapped(suite.Ctx, nil)
		suite.NoError(err)
		suite.True(userExists)
		suite.True(isBootstrapped)
	})

	suite.Run("IsBootstrapped Success with transaction", func() {
		// Clean up any existing data
		suite.DB.User.Delete().ExecX(suite.Ctx)
		suite.DB.Bootstrap.Delete().ExecX(suite.Ctx)

		tx, err := suite.DB.Tx(suite.Ctx)
		suite.NoError(err)
		defer tx.Rollback()

		// Create a user in transaction
		tx.User.Create().
			SetEmail("test3@example.com").
			SetPasswordHash("hash").
			SaveX(suite.Ctx)

		userExists, isBootstrapped, err := suite.bootstrapRepo.IsBootstrapped(suite.Ctx, tx)
		suite.NoError(err)
		suite.True(userExists)
		suite.True(isBootstrapped)
	})

	suite.Run("IsBootstrapped Error when DB closed", func() {
		// Clean up any existing data
		suite.DB.User.Delete().ExecX(suite.Ctx)
		suite.DB.Bootstrap.Delete().ExecX(suite.Ctx)

		suite.DB.Close()
		userExists, isBootstrapped, err := suite.bootstrapRepo.IsBootstrapped(suite.Ctx, nil)
		suite.Error(err)
		suite.False(userExists)
		suite.False(isBootstrapped)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestBootstrapQueriesSuite(t *testing.T) {
	suite.Run(t, new(BootstrapQueriesSuite))
}
