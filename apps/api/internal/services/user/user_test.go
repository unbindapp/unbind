package user_service

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/services"
)

type UserServiceSuite struct {
	services.ServiceTestSuite
	service *UserService

	requesterID uuid.UUID
	targetID    uuid.UUID
	targetUser  *ent.User
}

func (suite *UserServiceSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &UserService{repo: suite.MockRepo}

	suite.requesterID = uuid.New()
	suite.targetID = uuid.New()
	suite.targetUser = &ent.User{
		ID:    suite.targetID,
		Email: "target@example.com",
	}
}

func (suite *UserServiceSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *UserServiceSuite) TestListUsers() {
	suite.Run("Success", func() {
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(nil).Once()
		suite.MockUserRepo.EXPECT().GetAll(suite.Ctx).Return([]*ent.User{suite.targetUser}, nil).Once()

		users, err := suite.service.ListUsers(suite.Ctx, suite.requesterID)
		suite.NoError(err)
		suite.Len(users, 1)
	})

	suite.Run("Unauthorized", func() {
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(errdefs.ErrUnauthorized).Once()

		_, err := suite.service.ListUsers(suite.Ctx, suite.requesterID)
		suite.ErrorIs(err, errdefs.ErrUnauthorized)
	})
}

func (suite *UserServiceSuite) TestCreateUser() {
	suite.Run("Success", func() {
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(nil).Once()
		suite.MockUserRepo.EXPECT().Create(suite.Ctx, "new@example.com", "password").Return(suite.targetUser, nil).Once()

		user, err := suite.service.CreateUser(suite.Ctx, suite.requesterID, "new@example.com", "password")
		suite.NoError(err)
		suite.NotNil(user)
	})

	suite.Run("Unauthorized", func() {
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(errdefs.ErrUnauthorized).Once()

		_, err := suite.service.CreateUser(suite.Ctx, suite.requesterID, "new@example.com", "password")
		suite.ErrorIs(err, errdefs.ErrUnauthorized)
	})
}

func (suite *UserServiceSuite) TestUpdatePassword() {
	suite.Run("Self With Correct Current Password", func() {
		requester := &ent.User{ID: suite.requesterID, Email: "self@example.com"}
		suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.requesterID).Return(requester, nil).Once()
		suite.MockUserRepo.EXPECT().Authenticate(suite.Ctx, "self@example.com", "current").Return(requester, nil).Once()
		suite.MockUserRepo.EXPECT().UpdatePassword(suite.Ctx, suite.requesterID, "new-password").Return(nil).Once()

		user, err := suite.service.UpdatePassword(suite.Ctx, suite.requesterID, &UpdatePasswordInput{
			CurrentPassword: "current",
			NewPassword:     "new-password",
		})
		suite.NoError(err)
		suite.Equal(suite.requesterID, user.ID)
	})

	suite.Run("Self With Wrong Current Password", func() {
		requester := &ent.User{ID: suite.requesterID, Email: "self@example.com"}
		suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.requesterID).Return(requester, nil).Once()
		suite.MockUserRepo.EXPECT().Authenticate(suite.Ctx, "self@example.com", "wrong").Return(nil, errors.New("invalid password")).Once()

		_, err := suite.service.UpdatePassword(suite.Ctx, suite.requesterID, &UpdatePasswordInput{
			CurrentPassword: "wrong",
			NewPassword:     "new-password",
		})
		suite.ErrorIs(err, errdefs.ErrInvalidInput)
	})

	suite.Run("Self Without Current Password", func() {
		requester := &ent.User{ID: suite.requesterID, Email: "self@example.com"}
		suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.requesterID).Return(requester, nil).Once()

		_, err := suite.service.UpdatePassword(suite.Ctx, suite.requesterID, &UpdatePasswordInput{
			NewPassword: "new-password",
		})
		suite.ErrorIs(err, errdefs.ErrInvalidInput)
	})

	suite.Run("Other User As Admin", func() {
		suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.targetID).Return(suite.targetUser, nil).Once()
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(nil).Once()
		suite.MockUserRepo.EXPECT().UpdatePassword(suite.Ctx, suite.targetID, "new-password").Return(nil).Once()

		user, err := suite.service.UpdatePassword(suite.Ctx, suite.requesterID, &UpdatePasswordInput{
			UserID:      &suite.targetID,
			NewPassword: "new-password",
		})
		suite.NoError(err)
		suite.Equal(suite.targetID, user.ID)
	})

	suite.Run("Other User Without Permission", func() {
		suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.targetID).Return(suite.targetUser, nil).Once()
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(errdefs.ErrUnauthorized).Once()

		_, err := suite.service.UpdatePassword(suite.Ctx, suite.requesterID, &UpdatePasswordInput{
			UserID:      &suite.targetID,
			NewPassword: "new-password",
		})
		suite.ErrorIs(err, errdefs.ErrUnauthorized)
	})

	suite.Run("Target Not Found", func() {
		missingID := uuid.New()
		suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, missingID).Return(nil, &ent.NotFoundError{}).Once()

		_, err := suite.service.UpdatePassword(suite.Ctx, suite.requesterID, &UpdatePasswordInput{
			UserID:      &missingID,
			NewPassword: "new-password",
		})
		suite.ErrorIs(err, errdefs.ErrNotFound)
	})
}

func (suite *UserServiceSuite) TestDeleteUser() {
	suite.Run("Success", func() {
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(nil).Once()
		suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.targetID).Return(suite.targetUser, nil).Once()
		suite.MockUserRepo.EXPECT().Delete(suite.Ctx, suite.targetID).Return(nil).Once()

		err := suite.service.DeleteUser(suite.Ctx, suite.requesterID, suite.targetID)
		suite.NoError(err)
	})

	suite.Run("Self Delete Rejected", func() {
		err := suite.service.DeleteUser(suite.Ctx, suite.requesterID, suite.requesterID)
		suite.ErrorIs(err, errdefs.ErrInvalidInput)
	})

	suite.Run("Unauthorized", func() {
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(errdefs.ErrUnauthorized).Once()

		err := suite.service.DeleteUser(suite.Ctx, suite.requesterID, suite.targetID)
		suite.ErrorIs(err, errdefs.ErrUnauthorized)
	})

	suite.Run("Target Not Found", func() {
		suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, suite.requesterID, mock.Anything).Return(nil).Once()
		suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.targetID).Return(nil, &ent.NotFoundError{}).Once()

		err := suite.service.DeleteUser(suite.Ctx, suite.requesterID, suite.targetID)
		suite.ErrorIs(err, errdefs.ErrNotFound)
	})
}

func TestUserServiceSuite(t *testing.T) {
	suite.Run(t, new(UserServiceSuite))
}
