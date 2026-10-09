package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/k3s"
)

func initializeTokenInput(styles Styles) textinput.Model {
	ti := newInput(styles, "API token")
	ti.EchoMode = textinput.EchoPassword
	ti.Width = 64
	return ti
}

func (m Model) usesCloudVolumes() bool {
	return m.cloud != nil && m.storage.Backend == k3s.StorageCloudVolumes
}

// The storage choice only exists on a recognised cloud server; everyone else gets Longhorn.
func (m Model) afterRegistry() (Model, tea.Cmd) {
	if m.cloud == nil {
		return m.startConfigValidation()
	}
	m.state = StateStorageSelection
	return m, nil
}

func (m Model) backToRegistry() (Model, tea.Cmd) {
	if m.dnsInfo.RegistryType != RegistryExternal {
		m.state = StateRegistryTypeSelection
		return m, nil
	}
	m.state = StateExternalRegistryInput
	return m, m.usernameInput.Focus()
}

func viewStorageSelection(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)
	spec := m.cloud.Spec()

	s.WriteString(m.styles.Bold.Render("Choose where volumes are stored"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, fmt.Sprintf("This server runs on %s. Volumes for your services and databases can live on the server's own disk or on %s.", spec.DisplayName, spec.VolumeName), maxWidth)
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("1. Server disk (Longhorn)"))
	s.WriteString("\n")
	writeIndented(&s, m.styles.Normal, "   ", "Volumes use the disk this server already has", maxWidth)
	writeIndented(&s, m.styles.Subtle, "   ", "- No extra cost, any size", maxWidth)
	writeIndented(&s, m.styles.Subtle, "   ", "- Data stays on this server; a service with a volume always runs here", maxWidth)
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("2. " + spec.VolumeName))
	s.WriteString("\n")
	writeIndented(&s, m.styles.Normal, "   ", fmt.Sprintf("Network block storage attached to this server, billed by %s", spec.DisplayName), maxWidth)
	writeIndented(&s, m.styles.Subtle, "   ", fmt.Sprintf("- %s per GB per month (%s), billed hourly while a volume exists", spec.PricePerGB, spec.PriceNote), maxWidth)
	writeIndented(&s, m.styles.Subtle, "   ", fmt.Sprintf("- Minimum %d GB per volume, at most %d volumes per server", spec.MinGB, spec.MaxPerServer), maxWidth)
	writeIndented(&s, m.styles.Subtle, "   ", "- Volumes survive the server and can move to another server in the same location", maxWidth)
	writeIndented(&s, m.styles.Subtle, "   ", fmt.Sprintf("- Needs a %s API token, stored on this server", spec.DisplayName), maxWidth)
	s.WriteString("\n")

	writeWrapped(&s, m.styles.Warning, fmt.Sprintf("Every volume counts towards the %d per server limit, including the ones Unbind creates for the registry, logs, metrics and its own database.", spec.MaxPerServer), maxWidth)
	s.WriteString("\n")

	s.WriteString(renderKeyHints(m,
		keyHint{key: "1", desc: "Server disk"},
		keyHint{key: "2", desc: spec.VolumeName},
		keyHint{key: "Ctrl+b", desc: "Back to registry"},
	))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func (m Model) updateStorageSelectionState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}

	switch keyMsg.String() {
	case "1":
		m.storage = storageConfig{Backend: k3s.StorageLonghorn}
		return m.startConfigValidation()
	case "2":
		m.storage.Backend = k3s.StorageCloudVolumes
		m.state = StateCloudTokenInput
		return m, m.tokenInput.Focus()
	case "ctrl+b":
		return m.backToRegistry()
	}
	return m, nil
}

func viewCloudTokenInput(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)
	spec := m.cloud.Spec()

	s.WriteString(m.styles.Bold.Render("Enter your " + spec.DisplayName + " API token"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, spec.TokenHelp, maxWidth)
	writeWrapped(&s, m.styles.Key, spec.TokenURL, maxWidth)
	s.WriteString("\n")

	s.WriteString(renderInputBox(m, "API token", m.tokenInput))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Subtle, fmt.Sprintf("The token lets the storage driver create, attach and delete %s. It is kept as a secret inside your cluster. We'll validate it before proceeding.", spec.VolumeName), maxWidth)
	s.WriteString("\n")

	s.WriteString(renderKeyHints(m,
		keyHint{key: "Enter", desc: "Continue"},
		keyHint{key: "Ctrl+b", desc: "Back"},
	))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func (m Model) updateCloudTokenInputState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, isKey := msg.(tea.KeyMsg)
	if !isKey {
		return m.updateTokenInput(msg)
	}

	switch keyMsg.String() {
	case "ctrl+b":
		m.tokenInput.Blur()
		m.state = StateStorageSelection
		return m, nil
	case "enter":
		token := strings.TrimSpace(m.tokenInput.Value())
		if token == "" {
			return m, nil
		}
		m.storage.Token = token
		m.tokenInput.Blur()
		return m.startConfigValidation()
	}
	return m.updateTokenInput(msg)
}

func (m Model) updateTokenInput(msg tea.Msg) (Model, tea.Cmd) {
	var cmd tea.Cmd
	m.tokenInput, cmd = m.tokenInput.Update(msg)
	return m, cmd
}
