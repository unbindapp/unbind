package user_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type UserQueriesSuite struct {
	repository.RepositoryBaseSuite
	userRepo *UserRepository
	testUser *ent.User
}

func (suite *UserQueriesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.userRepo = NewUserRepository(suite.DB)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)
}

func (suite *UserQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.userRepo = nil
	suite.testUser = nil
}

func (suite *UserQueriesSuite) TestGetByID() {
	suite.Run("Get By ID Success", func() {
		user, err := suite.userRepo.GetByID(suite.Ctx, suite.testUser.ID)
		suite.NoError(err)
		suite.NotNil(user)
		suite.Equal(suite.testUser.ID, user.ID)
		suite.Equal("test@example.com", user.Email)
	})

	suite.Run("Get Non-existent User", func() {
		_, err := suite.userRepo.GetByID(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.userRepo.GetByID(suite.Ctx, suite.testUser.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *UserQueriesSuite) TestGetByEmail() {
	suite.Run("Get By Email Success", func() {
		user, err := suite.userRepo.GetByEmail(suite.Ctx, "test@example.com")
		suite.NoError(err)
		suite.NotNil(user)
		suite.Equal(suite.testUser.ID, user.ID)
		suite.Equal("test@example.com", user.Email)
	})

	suite.Run("Get Non-existent Email", func() {
		_, err := suite.userRepo.GetByEmail(suite.Ctx, "nonexistent@example.com")
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.userRepo.GetByEmail(suite.Ctx, "test@example.com")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *UserQueriesSuite) TestAuthenticate() {
	suite.Run("Authenticate Success", func() {
		user, err := suite.userRepo.Authenticate(suite.Ctx, "test@example.com", "test-password")
		suite.NoError(err)
		suite.NotNil(user)
		suite.Equal(suite.testUser.ID, user.ID)
	})

	suite.Run("Authenticate Wrong Password", func() {
		_, err := suite.userRepo.Authenticate(suite.Ctx, "test@example.com", "wrong-password")
		suite.Error(err)
		suite.Equal(ErrInvalidPassword, err)
	})

	suite.Run("Authenticate Non-existent User", func() {
		_, err := suite.userRepo.Authenticate(suite.Ctx, "nonexistent@example.com", "password")
		suite.Error(err)
		suite.Equal(ErrUserNotFound, err)
	})

	suite.Run("Authenticate Empty Credentials", func() {
		_, err := suite.userRepo.Authenticate(suite.Ctx, "", "password")
		suite.Error(err)
		suite.Equal(ErrInvalidUserInput, err)

		_, err = suite.userRepo.Authenticate(suite.Ctx, "test@example.com", "")
		suite.Error(err)
		suite.Equal(ErrInvalidUserInput, err)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.userRepo.Authenticate(suite.Ctx, "test@example.com", "test-password")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *UserQueriesSuite) TestGetGroups() {
	suite.Run("Get Groups Success", func() {
		// Create a group and add user to it
		group := suite.DB.Group.Create().
			SetName("Test Group").
			SetDescription("Test group description").
			SaveX(suite.Ctx)

		suite.DB.User.UpdateOneID(suite.testUser.ID).
			AddGroupIDs(group.ID).
			SaveX(suite.Ctx)

		groups, err := suite.userRepo.GetGroups(suite.Ctx, suite.testUser.ID)
		suite.NoError(err)
		suite.Len(groups, 1)
		suite.Equal(group.ID, groups[0].ID)
		suite.Equal("Test Group", groups[0].Name)
	})

	suite.Run("Get Groups No Groups", func() {
		// Create user without groups
		pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
		user := suite.DB.User.Create().
			SetEmail("nogroups@example.com").
			SetPasswordHash(string(pwd)).
			SaveX(suite.Ctx)

		groups, err := suite.userRepo.GetGroups(suite.Ctx, user.ID)
		suite.NoError(err)
		suite.Len(groups, 0)
	})

	suite.Run("Get Groups Non-existent User", func() {
		groups, err := suite.userRepo.GetGroups(suite.Ctx, uuid.New())
		suite.NoError(err)
		suite.Len(groups, 0)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.userRepo.GetGroups(suite.Ctx, suite.testUser.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestUserQueriesSuite(t *testing.T) {
	suite.Run(t, new(UserQueriesSuite))
}
