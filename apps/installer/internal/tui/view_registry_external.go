package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type registryOption struct {
	key         string
	host        string
	displayName string
}

var registryOptions = []registryOption{
	{key: "f1", host: "docker.io", displayName: "Docker Hub"},
	{key: "f2", host: "ghcr.io", displayName: "GitHub Container Registry"},
	{key: "f3", host: "quay.io", displayName: "Red Hat Quay"},
	{key: "f4", host: "", displayName: "Custom Registry"},
}

const customRegistryIndex = 3

func getRegistryDisplayName(host string) string {
	for _, opt := range registryOptions {
		if opt.host != "" && opt.host == host {
			return opt.displayName
		}
	}
	return host
}

func newInput(styles Styles, placeholder string) textinput.Model {
	ti := textinput.New()
	ti.Placeholder = placeholder
	ti.Width = 30
	ti.PromptStyle = styles.InputPrompt
	return ti
}

func initializeUsernameInput(styles Styles) textinput.Model {
	return newInput(styles, "username")
}

func initializePasswordInput(styles Styles) textinput.Model {
	ti := newInput(styles, "password")
	ti.EchoMode = textinput.EchoPassword
	return ti
}

func initializeRegistryHostInput(styles Styles) textinput.Model {
	return newInput(styles, "registry.example.com")
}

func viewRegistryTypeSelection(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Bold.Render("Select Registry Type for Unbind"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, "Unbind requires a container registry to store Docker images. You can:", maxWidth)
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("1. Self-hosted Registry"))
	s.WriteString("\n")
	writeIndented(&s, m.styles.Normal, "   ", "Allow Unbind to install a registry on your server", maxWidth)
	writeIndented(&s, m.styles.Subtle, "   ", "- Runs in-cluster, no domain or extra DNS records needed", maxWidth)
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("2. External Registry"))
	s.WriteString("\n")
	writeIndented(&s, m.styles.Normal, "   ", "Use Docker Hub, GHCR, Quay, or another registry service", maxWidth)
	writeIndented(&s, m.styles.Subtle, "   ", "- Requires existing account credentials", maxWidth)
	s.WriteString("\n")

	s.WriteString(renderKeyHints(m,
		keyHint{key: "1", desc: "Self-hosted registry"},
		keyHint{key: "2", desc: "External registry"},
		keyHint{key: "Ctrl+b", desc: "Back to DNS configuration"},
	))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func (m Model) updateRegistryTypeSelectionState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}

	switch keyMsg.String() {
	case "1":
		m.dnsInfo.RegistryType = RegistrySelfHosted
		return m.startConfigValidation()
	case "2":
		m.dnsInfo.RegistryType = RegistryExternal
		m.state = StateExternalRegistryInput
		return m, m.usernameInput.Focus()
	case "ctrl+b":
		m.state = StateDNSConfig
		return m, m.domainInput.Focus()
	}
	return m, nil
}

func viewExternalRegistryInput(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Bold.Render("Enter External Registry Credentials"))
	s.WriteString("\n\n")
	s.WriteString(m.styles.Bold.Render("Select Registry:"))
	s.WriteString("\n")
	for i, opt := range registryOptions {
		label := fmt.Sprintf("[%s] %s", strings.ToUpper(opt.key), opt.displayName)
		if opt.host != "" {
			label += fmt.Sprintf(" (%s)", opt.host)
		}
		if i == m.selectedRegistry {
			s.WriteString(m.styles.SelectedOption.Render("→ " + label))
		} else {
			s.WriteString(m.styles.Normal.Render("  " + label))
		}
		s.WriteString("\n")
	}
	s.WriteString("\n")

	if m.selectedRegistry == customRegistryIndex {
		s.WriteString(renderInputBox(m, "Registry Host", m.registryHostInput))
		s.WriteString("\n\n")
	}

	s.WriteString(renderInputBox(m, "Username", m.usernameInput))
	s.WriteString("\n\n")
	s.WriteString(renderInputBox(m, "Password", m.passwordInput))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Subtle, "Fill in all fields; we'll validate these credentials before proceeding.", maxWidth)
	s.WriteString("\n")

	s.WriteString(renderKeyHints(m,
		keyHint{key: "Tab", desc: "Next field"},
		keyHint{key: "F1-F4", desc: "Select registry"},
		keyHint{key: "Enter", desc: "Continue"},
		keyHint{key: "Ctrl+b", desc: "Back"},
	))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func (m Model) updateExternalRegistryInputState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, isKey := msg.(tea.KeyMsg)
	if !isKey {
		return m.updateFocusedRegistryInput(msg)
	}

	switch key := keyMsg.String(); key {
	case "ctrl+b":
		m.state = StateRegistryTypeSelection
		return m, nil
	case "tab":
		return m.focusNextRegistryField()
	case "enter":
		if !m.passwordInput.Focused() {
			return m.focusNextRegistryField()
		}
		return m.submitRegistryCredentials()
	}

	for i, opt := range registryOptions {
		if keyMsg.String() != opt.key {
			continue
		}
		m.selectedRegistry = i
		return m.syncRegistryFields(), nil
	}

	return m.updateFocusedRegistryInput(msg)
}

func (m Model) registryFields() []*textinput.Model {
	fields := []*textinput.Model{&m.usernameInput, &m.passwordInput}
	if m.selectedRegistry != customRegistryIndex {
		return fields
	}
	return append([]*textinput.Model{&m.registryHostInput}, fields...)
}

func (m Model) focusNextRegistryField() (Model, tea.Cmd) {
	fields := m.registryFields()
	next := 0
	for i, field := range fields {
		if !field.Focused() {
			continue
		}
		field.Blur()
		next = (i + 1) % len(fields)
		break
	}
	return m, fields[next].Focus()
}

func (m Model) updateFocusedRegistryInput(msg tea.Msg) (Model, tea.Cmd) {
	var cmd tea.Cmd
	switch {
	case m.registryHostInput.Focused():
		m.registryHostInput, cmd = m.registryHostInput.Update(msg)
	case m.usernameInput.Focused():
		m.usernameInput, cmd = m.usernameInput.Update(msg)
	default:
		m.passwordInput, cmd = m.passwordInput.Update(msg)
	}
	return m.syncRegistryFields(), cmd
}

func (m Model) syncRegistryFields() Model {
	m.dnsInfo.RegistryUsername = m.usernameInput.Value()
	m.dnsInfo.RegistryPassword = m.passwordInput.Value()
	m.dnsInfo.RegistryHost = m.selectedRegistryHost()
	return m
}

func (m Model) selectedRegistryHost() string {
	if m.selectedRegistry == customRegistryIndex {
		return strings.TrimSpace(m.registryHostInput.Value())
	}
	return registryOptions[m.selectedRegistry].host
}

func (m Model) submitRegistryCredentials() (Model, tea.Cmd) {
	m = m.syncRegistryFields()
	if m.dnsInfo.RegistryUsername == "" || m.dnsInfo.RegistryPassword == "" || m.dnsInfo.RegistryHost == "" {
		return m, nil
	}
	return m.startConfigValidation()
}
