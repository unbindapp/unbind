// Package mail sends transactional email over an SMTP relay the instance admin
// configures. Unbind never runs a mail server of its own: inbox placement
// depends on the sending domain's DNS records and the relay's reputation.
package mail

import (
	"bytes"
	"context"
	"fmt"
	"time"

	gomail "github.com/wneessen/go-mail"
)

type Encryption string

const (
	EncryptionStartTLS Encryption = "starttls"
	EncryptionTLS      Encryption = "tls"
	EncryptionNone     Encryption = "none"
)

type Settings struct {
	Host        string
	Port        int
	Username    string
	Password    string
	FromAddress string
	FromName    string
	Encryption  Encryption
}

type Message struct {
	To      string
	Subject string
	Text    string
	HTML    string
	Inline  []Inline
}

// Inline is an image the HTML body references as cid:<Name>.
type Inline struct {
	Name        string
	ContentType string
	Data        []byte
}

type Sender interface {
	Send(ctx context.Context, settings Settings, msg Message) error
}

type SMTPSender struct{}

func (SMTPSender) Send(ctx context.Context, settings Settings, msg Message) error {
	opts := []gomail.Option{
		gomail.WithPort(settings.Port),
		gomail.WithTimeout(20 * time.Second),
	}
	// go-mail will not negotiate PLAIN or LOGIN auth on a plaintext connection,
	// so "none" opts into that explicitly: the admin chose to send in the clear.
	auth := gomail.SMTPAuthAutoDiscover
	switch settings.Encryption {
	case EncryptionTLS:
		opts = append(opts, gomail.WithSSL())
	case EncryptionNone:
		opts = append(opts, gomail.WithTLSPolicy(gomail.NoTLS))
		auth = gomail.SMTPAuthPlainNoEnc
	default:
		opts = append(opts, gomail.WithTLSPolicy(gomail.TLSMandatory))
	}
	if settings.Username != "" {
		opts = append(opts,
			gomail.WithSMTPAuth(auth),
			gomail.WithUsername(settings.Username),
			gomail.WithPassword(settings.Password),
		)
	}

	client, err := gomail.NewClient(settings.Host, opts...)
	if err != nil {
		return fmt.Errorf("mail client: %w", err)
	}

	m := gomail.NewMsg()
	if err := m.FromFormat(settings.FromName, settings.FromAddress); err != nil {
		return fmt.Errorf("from address: %w", err)
	}
	if err := m.To(msg.To); err != nil {
		return fmt.Errorf("to address: %w", err)
	}
	m.Subject(msg.Subject)
	m.SetBodyString(gomail.TypeTextPlain, msg.Text)
	m.AddAlternativeString(gomail.TypeTextHTML, msg.HTML)
	for _, inline := range msg.Inline {
		if err := m.EmbedReader(inline.Name, bytes.NewReader(inline.Data), gomail.WithFileContentType(gomail.ContentType(inline.ContentType))); err != nil {
			return fmt.Errorf("embed %s: %w", inline.Name, err)
		}
	}

	return client.DialAndSendWithContext(ctx, m)
}
