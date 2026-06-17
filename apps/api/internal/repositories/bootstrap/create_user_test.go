package bootstrap_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent/user"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type BSCreateUserSuite struct {
	repository.RepositoryBaseSuite
	bootstrapRepo *BootstrapRepository
}

func (suite *BSCreateUserSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.bootstrapRepo = NewBootstrapRepository(suite.DB)

	// Create a group for the user to be created in
	suite.DB.Group.Create().
		SetName("default").
		SetK8sRoleName("default").
		SaveX(suite.Ctx)
}

func (suite *BSCreateUserSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.bootstrapRepo = nil
}

func (suite *BSCreateUserSuite) TestCreateUser() {
	suite.Run("CreateUser Success", func() {
		dbUser, err := suite.bootstrapRepo.CreateUser(suite.Ctx, "testuser@unbind.app", "password123")
		suite.NoError(err)
		suite.NotNil(dbUser)
		suite.Equal("testuser@unbind.app", dbUser.Email)
		suite.NotEqual("password123", dbUser.PasswordHash)
		// Make sure password is a bcrypt hash (regex)
		suite.Regexp(`^\$2[ayb]\$[0-9]{2}\$[./0-9A-Za-z]{53}$`, dbUser.PasswordHash)

		// Fetch the groups the user is in
		groups := suite.DB.User.Query().Where(
			user.IDEQ(dbUser.ID),
		).QueryGroups().AllX(suite.Ctx)
		suite.Len(groups, 1)
		suite.Equal("default", groups[0].Name)
	})

	suite.Run("CreateUser Error if already created", func() {
		// Try to create the user again, should return an error
		_, err := suite.bootstrapRepo.CreateUser(suite.Ctx, "user2@unbind.app", "password456")
		suite.ErrorIs(err, errdefs.ErrAlreadyBootstrapped)
	})

	suite.Run("CreateUser Error if already bootstrapped", func() {
		// Wipe users
		suite.DB.User.Delete().ExecX(suite.Ctx)
		// Set bootstrap flag
		suite.DB.Bootstrap.Create().SetIsBootstrapped(true).SaveX(suite.Ctx)
		// Try to create the user, should return an error
		_, err := suite.bootstrapRepo.CreateUser(suite.Ctx, "user2@unbind.app", "password456")
		suite.ErrorIs(err, errdefs.ErrAlreadyBootstrapped)
	})

	suite.Run("CreateUser error when DB closed", func() {
		// Wipe users
		suite.DB.User.Delete().ExecX(suite.Ctx)
		// Close the DB connection
		suite.DB.Close()
		// Try to create the user, should return an error
		_, err := suite.bootstrapRepo.CreateUser(suite.Ctx, "user2@unbind.app", "password456")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestBSCreateUserSuite(t *testing.T) {
	suite.Run(t, new(BSCreateUserSuite))
}
