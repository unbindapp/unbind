package user_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/services"
)

// A new password ends every other session of the account
type PasswordSuite struct {
	services.ServiceTestSuite
	service *UserService
	user    *ent.User
}

func (suite *PasswordSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &UserService{repo: suite.MockRepo}
	suite.user = &ent.User{ID: uuid.New(), Email: "me@example.com"}
	suite.MockUserRepo.EXPECT().GetByID(suite.Ctx, suite.user.ID).Return(suite.user, nil)
	suite.MockUserRepo.EXPECT().UpdatePassword(suite.Ctx, suite.user.ID, "new-password-123").Return(nil)
}

func (suite *PasswordSuite) TestOwnChangeKeepsTheCurrentSession() {
	suite.MockUserRepo.EXPECT().Authenticate(suite.Ctx, suite.user.Email, "old").Return(suite.user, nil)
	suite.MockOauthRepo.EXPECT().RevokeUserTokens(suite.Ctx, suite.user.ID, "refresh-current").Return(nil)

	_, err := suite.service.UpdatePassword(suite.Ctx, suite.user.ID, &UpdatePasswordInput{CurrentPassword: "old", NewPassword: "new-password-123", KeepRefreshToken: "refresh-current"})
	suite.NoError(err)
}

func (suite *PasswordSuite) TestAdminResetEndsEverySession() {
	admin := uuid.New()
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, admin, mock.Anything).Return(nil)
	suite.MockOauthRepo.EXPECT().RevokeUserTokens(suite.Ctx, suite.user.ID, "").Return(nil)

	_, err := suite.service.UpdatePassword(suite.Ctx, admin, &UpdatePasswordInput{UserID: &suite.user.ID, NewPassword: "new-password-123", KeepRefreshToken: "admins-own-session"})
	suite.NoError(err)
}

func TestPasswordSuite(t *testing.T) {
	suite.Run(t, new(PasswordSuite))
}
