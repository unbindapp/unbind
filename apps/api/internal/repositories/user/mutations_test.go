package user_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	"golang.org/x/crypto/bcrypt"
)

type UserMutationsSuite struct {
	repository.RepositoryBaseSuite
	userRepo *UserRepository
	testUser *ent.User
}

func (suite *UserMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.userRepo = NewUserRepository(suite.DB)

	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)
}

func (suite *UserMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.userRepo = nil
	suite.testUser = nil
}

func (suite *UserMutationsSuite) TestGetAll() {
	users, err := suite.userRepo.GetAll(suite.Ctx)
	suite.NoError(err)
	suite.Len(users, 1)
	suite.Equal(suite.testUser.ID, users[0].ID)
}

func (suite *UserMutationsSuite) TestCreate() {
	suite.Run("Create Success", func() {
		user, err := suite.userRepo.Create(suite.Ctx, "new@example.com", "new-password")
		suite.NoError(err)
		suite.Equal("new@example.com", user.Email)

		authenticated, err := suite.userRepo.Authenticate(suite.Ctx, "new@example.com", "new-password")
		suite.NoError(err)
		suite.Equal(user.ID, authenticated.ID)
	})

	suite.Run("Duplicate Email", func() {
		_, err := suite.userRepo.Create(suite.Ctx, "test@example.com", "another-password")
		suite.Error(err)
		suite.True(ent.IsConstraintError(err))
	})

	suite.Run("Empty Input", func() {
		_, err := suite.userRepo.Create(suite.Ctx, "", "password")
		suite.ErrorIs(err, ErrInvalidUserInput)

		_, err = suite.userRepo.Create(suite.Ctx, "empty@example.com", "")
		suite.ErrorIs(err, ErrInvalidUserInput)
	})
}

func (suite *UserMutationsSuite) TestUpdatePassword() {
	suite.Run("Update Success", func() {
		err := suite.userRepo.UpdatePassword(suite.Ctx, suite.testUser.ID, "changed-password")
		suite.NoError(err)

		_, err = suite.userRepo.Authenticate(suite.Ctx, "test@example.com", "changed-password")
		suite.NoError(err)

		_, err = suite.userRepo.Authenticate(suite.Ctx, "test@example.com", "test-password")
		suite.ErrorIs(err, ErrInvalidPassword)
	})

	suite.Run("Empty Password", func() {
		err := suite.userRepo.UpdatePassword(suite.Ctx, suite.testUser.ID, "")
		suite.ErrorIs(err, ErrInvalidUserInput)
	})

	suite.Run("Non-existent User", func() {
		err := suite.userRepo.UpdatePassword(suite.Ctx, uuid.New(), "password")
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})
}

func (suite *UserMutationsSuite) TestDelete() {
	suite.Run("Delete Success", func() {
		err := suite.userRepo.Delete(suite.Ctx, suite.testUser.ID)
		suite.NoError(err)

		_, err = suite.userRepo.GetByID(suite.Ctx, suite.testUser.ID)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Non-existent User", func() {
		err := suite.userRepo.Delete(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})
}

func TestUserMutationsSuite(t *testing.T) {
	suite.Run(t, new(UserMutationsSuite))
}
