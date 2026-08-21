package tui

import (
	"errors"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/utils"
)

const domainPlaceholder = "unbind.yourdomain.com"

func initializeDomainInput(styles Styles) textinput.Model {
	ti := newInput(styles, domainPlaceholder)
	ti.Validate = validateDomainInput
	return ti
}

func validateDomainInput(domain string) error {
	if strings.HasPrefix(domain, "*") {
		return errors.New("Enter the Unbind domain without the wildcard, e.g. " + domainPlaceholder)
	}
	if !utils.IsDNSName(domain) {
		return fmt.Errorf("%s is not a valid domain", domain)
	}
	return nil
}

func normalizeDomain(domain string) string {
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(domain)), ".")
}

func viewDNSConfig(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Bold.Render("Configure DNS for Unbind"))
	s.WriteString("\n\n")
	s.WriteString(m.styles.Bold.Render("External IP: "))
	s.WriteString(m.styles.Key.Render(m.dnsInfo.ExternalIP))
	s.WriteString("\n\n")

	s.WriteString(renderInputBox(m, "Domain", m.domainInput))
	s.WriteString("\n")
	switch errText := m.domainInputError(); errText {
	case "":
		writeWrapped(&s, m.styles.Subtle, "The domain you'll use to access Unbind, e.g. "+domainPlaceholder, maxWidth)
	default:
		writeWrapped(&s, m.styles.Error, errText, maxWidth)
	}
	s.WriteString("\n")

	writeWrapped(&s, m.styles.Normal, "Create these DNS records at your provider, pointing to your external IP:", maxWidth)
	s.WriteString(renderDNSRecordsTable(m, m.previewDomain()))
	s.WriteString("\n")
	writeWrapped(&s, m.styles.Warning, "Wildcard record is optional. If not detected it'll disable automatic domain generation for your services", maxWidth)
	s.WriteString("\n")

	s.WriteString(continueButton(m))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func (m Model) domainInputError() string {
	if m.domainError != "" {
		return m.domainError
	}
	if m.domainInput.Err != nil && m.domainInput.Value() != "" {
		return m.domainInput.Err.Error()
	}
	return ""
}

func (m Model) previewDomain() string {
	domain := normalizeDomain(m.domainInput.Value())
	if domain == "" || validateDomainInput(domain) != nil {
		return domainPlaceholder
	}
	return domain
}

func (m Model) updateDNSConfigState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, isKey := msg.(tea.KeyMsg)
	if isKey && keyMsg.String() == "enter" {
		return m.submitDomain()
	}

	var cmd tea.Cmd
	m.domainInput, cmd = m.domainInput.Update(msg)
	if isKey {
		m.domainError = ""
	}
	return m, cmd
}

func (m Model) submitDomain() (Model, tea.Cmd) {
	domain := normalizeDomain(m.domainInput.Value())
	if domain == "" {
		m.domainError = "Enter a domain to continue"
		return m, nil
	}
	if err := validateDomainInput(domain); err != nil {
		m.domainError = err.Error()
		return m, nil
	}

	m.domainInput.SetValue(domain)
	m.dnsInfo.UnbindDomain = domain
	m.state = StateRegistryTypeSelection
	return m, nil
}
