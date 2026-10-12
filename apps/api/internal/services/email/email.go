// Package email_service owns the outgoing mail settings and sends every mail
// Unbind produces. Without a configured relay it sends nothing and says so.
package email_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/mail"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	system_repo "github.com/unbindapp/unbind-api/internal/repositories/system"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const (
	smtpSecretName = "unbind-smtp"
	smtpSecretKey  = "password"
)

type EmailService struct {
	cfg    *config.Config
	repo   repositories.RepositoriesInterface
	k8s    k8s.KubeClientInterface
	sender mail.Sender
}

func NewEmailService(cfg *config.Config, repo repositories.RepositoriesInterface, k8sClient k8s.KubeClientInterface, sender mail.Sender) *EmailService {
	return &EmailService{cfg: cfg, repo: repo, k8s: k8sClient, sender: sender}
}

type EmailSettingsResponse struct {
	Configured bool                  `json:"configured" doc:"True when a relay is set up and Unbind can send mail"`
	Settings   *schema.EmailSettings `json:"settings,omitempty" required:"false"`
}

type EmailSettingsUpdateInput struct {
	schema.EmailSettings
	Password *string `json:"password" required:"false" doc:"Omit to keep the stored password; send an empty string to clear it"`
}

func (self *EmailService) GetSettings(ctx context.Context, requesterUserID uuid.UUID) (*EmailSettingsResponse, error) {
	if err := self.checkSystem(ctx, requesterUserID, schema.ActionViewer); err != nil {
		return nil, err
	}
	settings, err := self.repo.System().GetSystemSettings(ctx, nil)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	if settings == nil || settings.EmailSettings == nil {
		return &EmailSettingsResponse{}, nil
	}
	return &EmailSettingsResponse{Configured: true, Settings: settings.EmailSettings}, nil
}

func (self *EmailService) UpdateSettings(ctx context.Context, requesterUserID uuid.UUID, input *EmailSettingsUpdateInput) (*EmailSettingsResponse, error) {
	if err := self.checkSystem(ctx, requesterUserID, schema.ActionEditor); err != nil {
		return nil, err
	}
	switch mail.Encryption(input.Encryption) {
	case mail.EncryptionStartTLS, mail.EncryptionTLS, mail.EncryptionNone:
	default:
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Encryption must be starttls, tls or none")
	}

	if input.Password != nil {
		if err := self.storePassword(ctx, *input.Password); err != nil {
			return nil, err
		}
	}

	settings := input.EmailSettings
	if _, err := self.repo.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{EmailSettings: &settings}); err != nil {
		return nil, err
	}
	return &EmailSettingsResponse{Configured: true, Settings: &settings}, nil
}

func (self *EmailService) ClearSettings(ctx context.Context, requesterUserID uuid.UUID) error {
	if err := self.checkSystem(ctx, requesterUserID, schema.ActionEditor); err != nil {
		return err
	}
	if _, err := self.repo.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{ClearEmailSettings: true}); err != nil {
		return err
	}
	err := self.k8s.DeleteSecret(ctx, smtpSecretName, self.cfg.SystemNamespace, self.k8s.GetInternalClient())
	if err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	return nil
}

// SendTest mails the requester so the relay can be checked from the UI.
func (self *EmailService) SendTest(ctx context.Context, requesterUserID uuid.UUID) error {
	if err := self.checkSystem(ctx, requesterUserID, schema.ActionEditor); err != nil {
		return err
	}
	user, err := self.repo.User().GetByID(ctx, requesterUserID)
	if err != nil {
		return err
	}
	sent, err := self.Send(ctx, user.Email, mail.Content{
		Subject:    "Unbind can send email",
		Heading:    "Email is working",
		Paragraphs: []string{"This is a test message from your Unbind instance. Invitations and notifications will be delivered the same way."},
	})
	if err != nil {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Sending failed: %v", err))
	}
	if !sent {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Email is not configured")
	}
	return nil
}

// Send delivers one message. sent is false, with no error, when no relay is
// configured, so callers can fall back to showing a link.
func (self *EmailService) Send(ctx context.Context, to string, content mail.Content) (sent bool, err error) {
	settings, configured, err := self.settings(ctx)
	if err != nil || !configured {
		return false, err
	}
	if content.InstanceURL == "" {
		content.InstanceURL = self.cfg.ExternalUIUrl
	}
	msg, err := mail.Render(to, content)
	if err != nil {
		return false, err
	}
	if err := self.sender.Send(ctx, settings, msg); err != nil {
		return false, err
	}
	return true, nil
}

func (self *EmailService) settings(ctx context.Context) (mail.Settings, bool, error) {
	stored, err := self.repo.System().GetSystemSettings(ctx, nil)
	if err != nil && !ent.IsNotFound(err) {
		return mail.Settings{}, false, err
	}
	if stored == nil || stored.EmailSettings == nil {
		return mail.Settings{}, false, nil
	}
	cfg := stored.EmailSettings

	password := ""
	if cfg.Username != "" {
		value, err := self.k8s.GetSecretValue(ctx, smtpSecretName, self.cfg.SystemNamespace, smtpSecretKey, self.k8s.GetInternalClient())
		if err != nil && !apierrors.IsNotFound(err) {
			return mail.Settings{}, false, err
		}
		password = string(value)
	}

	return mail.Settings{
		Host:        cfg.Host,
		Port:        cfg.Port,
		Username:    cfg.Username,
		Password:    password,
		FromAddress: cfg.FromAddress,
		FromName:    cfg.FromName,
		Encryption:  mail.Encryption(cfg.Encryption),
	}, true, nil
}

func (self *EmailService) storePassword(ctx context.Context, password string) error {
	client := self.k8s.GetInternalClient()
	if _, _, err := self.k8s.GetOrCreateSecret(ctx, smtpSecretName, self.cfg.SystemNamespace, client); err != nil {
		return err
	}
	_, err := self.k8s.UpsertSecretValues(ctx, smtpSecretName, self.cfg.SystemNamespace, map[string][]byte{smtpSecretKey: []byte(password)}, client)
	return err
}

func (self *EmailService) checkSystem(ctx context.Context, requesterUserID uuid.UUID, action schema.PermittedAction) error {
	return self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{Action: action, ResourceType: schema.ResourceTypeSystem},
	})
}
