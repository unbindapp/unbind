package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

func viewCheckK3s(m Model) string {
	s := strings.Builder{}
	if m.isLoading {
		s.WriteString(m.spinner.View())
	}
	s.WriteString(m.styles.Bold.Render("Checking for existing K3s installation..."))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func viewConfirmUninstallK3s(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Error.Render("! Existing K3s Installation Found!"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, "An existing K3s installation (or remnants) was detected.", maxWidth)
	writeWrapped(&s, m.styles.Normal, "To ensure a clean setup for Unbind, it's recommended to uninstall the existing K3s first.", maxWidth)
	s.WriteString("\n")

	s.WriteString(renderKeyHints(m,
		keyHint{key: "y", desc: "Uninstall it now"},
		keyHint{key: "n", desc: "Quit"},
	))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func viewUninstallingK3s(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	if m.isLoading {
		s.WriteString(m.spinner.View())
	}
	s.WriteString(m.styles.Bold.Render("Uninstalling existing K3s installation..."))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Subtle, "Uninstall process started. Pressing Ctrl+c will attempt to quit, but the uninstall may continue in the background.", maxWidth)
	return renderPage(m, s.String())
}

func (m Model) updateCheckK3sState(msg tea.Msg) (Model, tea.Cmd) {
	result, ok := msg.(k3sCheckResultMsg)
	if !ok {
		return m, nil
	}
	if result.err != nil {
		return m.fail(result.err)
	}
	if !result.checkResult.IsInstalled {
		return m.transition(StateLoading, true, detectOSInfo)
	}

	m.k3sUninstallScriptPath = result.checkResult.UninstallScript
	return m.transition(StateConfirmUninstallK3s, false)
}

func (m Model) updateConfirmUninstallK3sState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}

	switch strings.ToLower(keyMsg.String()) {
	case "y", "enter":
		return m.startK3sUninstall()
	case "n":
		return m, tea.Quit
	}
	return m, nil
}

func (m Model) startK3sUninstall() (Model, tea.Cmd) {
	if m.k3sUninstallScriptPath == "" {
		return m.fail(fmt.Errorf("internal error: K3s uninstall path not found"))
	}
	return m.transition(StateUninstallingK3s, true, m.uninstallK3sCommand(m.k3sUninstallScriptPath))
}

func (m Model) updateUninstallingK3sState(msg tea.Msg) (Model, tea.Cmd) {
	result, ok := msg.(k3sUninstallCompleteMsg)
	if !ok {
		return m, nil
	}
	if result.err != nil {
		return m.fail(result.err)
	}
	return m.transition(StateLoading, true, detectOSInfo)
}
