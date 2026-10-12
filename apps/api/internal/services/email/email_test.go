package email_service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/infrastructure/mail"
	"github.com/unbindapp/unbind-api/internal/services"
	"k8s.io/client-go/kubernetes"
)

type recordingSender struct {
	settings mail.Settings
	msg      mail.Message
}

func (s *recordingSender) Send(_ context.Context, settings mail.Settings, msg mail.Message) error {
	s.settings, s.msg = settings, msg
	return nil
}

type EmailSuite struct {
	services.ServiceTestSuite
	service *EmailService
	sender  *recordingSender
}

func (suite *EmailSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.sender = &recordingSender{}
	suite.service = &EmailService{cfg: &config.Config{SystemNamespace: "unbind-system", ExternalUIUrl: "https://unbind.example"}, repo: suite.MockRepo, k8s: suite.MockK8s, sender: suite.sender}
}

func (suite *EmailSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *EmailSuite) TestSendIsANoopWithoutARelay() {
	suite.MockSystemRepo.EXPECT().GetSystemSettings(suite.Ctx, nil).Return(&ent.SystemSetting{}, nil).Once()

	sent, err := suite.service.Send(suite.Ctx, "dev@example.com", mail.Content{Subject: "hi"})
	suite.NoError(err)
	suite.False(sent)
}

func (suite *EmailSuite) TestSendReadsThePasswordFromTheSecretAndRendersBothBodies() {
	client := &kubernetes.Clientset{}
	suite.MockSystemRepo.EXPECT().GetSystemSettings(suite.Ctx, nil).Return(&ent.SystemSetting{EmailSettings: &schema.EmailSettings{
		Host: "smtp.example", Port: 587, Username: "apikey", FromAddress: "unbind@example.com", FromName: "Unbind", Encryption: "starttls",
	}}, nil).Once()
	suite.MockK8s.EXPECT().GetInternalClient().Return(client).Once()
	suite.MockK8s.EXPECT().GetSecretValue(suite.Ctx, "unbind-smtp", "unbind-system", "password", client).Return([]byte("s3cret"), nil).Once()

	sent, err := suite.service.Send(suite.Ctx, "dev@example.com", mail.Content{
		Subject: "Join Acme", Heading: "Join Acme", Paragraphs: []string{"<b>admin</b> invited you"}, ButtonLabel: "Accept", ButtonURL: "https://unbind.example/invite/tok",
	})
	suite.Require().NoError(err)
	suite.True(sent)
	suite.Equal("s3cret", suite.sender.settings.Password)
	suite.Equal(mail.EncryptionStartTLS, suite.sender.settings.Encryption)
	suite.Equal("dev@example.com", suite.sender.msg.To)
	suite.Contains(suite.sender.msg.HTML, "&lt;b&gt;admin&lt;/b&gt; invited you")
	suite.Contains(suite.sender.msg.HTML, `href="https://unbind.example/invite/tok"`)
	suite.Contains(suite.sender.msg.Text, "Accept: https://unbind.example/invite/tok")
	suite.Contains(suite.sender.msg.Text, "<b>admin</b> invited you")
}

func (suite *EmailSuite) TestUpdateRejectsUnknownEncryption() {
	suite.MockPermissionsRepo.EXPECT().Check(suite.Ctx, uuid.Nil, mock.Anything).Return(nil).Once()

	_, err := suite.service.UpdateSettings(suite.Ctx, uuid.Nil, &EmailSettingsUpdateInput{EmailSettings: schema.EmailSettings{Host: "h", Port: 25, FromAddress: "a@b.c", Encryption: "ssl"}})
	suite.ErrorContains(err, "Encryption must be")
}

func TestEmailSuite(t *testing.T) {
	suite.Run(t, new(EmailSuite))
}
