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
	if m.k3sIsUnbindServer {
		return viewExistingUnbindServer(m)
	}

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

func viewExistingUnbindServer(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Bold.Render("Existing Unbind server found"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, "This host already runs an Unbind server. You can bring its k3s and kubelet settings up to date without touching any data, or remove it to start over.", maxWidth)
	writeWrapped(&s, m.styles.Subtle, "Updating restarts k3s once. Running workloads stay up during the restart.", maxWidth)
	s.WriteString("\n")

	s.WriteString(renderKeyHints(m,
		keyHint{key: "u", desc: "Update this server's configuration"},
		keyHint{key: "y", desc: "Uninstall Unbind and start over"},
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

func viewUpdatingNode(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	if m.isLoading {
		s.WriteString(m.spinner.View())
	}
	s.WriteString(m.styles.Bold.Render("Updating this server's k3s configuration..."))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Subtle, "Writing the kubelet config, regenerating the k3s service and restarting it. This takes about a minute.", maxWidth)
	return renderPage(m, s.String())
}

func viewNodeUpdated(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Success.Render("Server configuration updated"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, "This server now runs the current k3s and kubelet settings.", maxWidth)
	writeWrapped(&s, m.styles.Normal, "Other nodes in the cluster: run 'unbind add-node' here and repeat the kubelet and join steps on each of them.", maxWidth)
	s.WriteString("\n")
	s.WriteString(m.styles.Subtle.Render("Press any key to exit"))
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
	m.k3sIsUnbindServer = result.checkResult.IsUnbindServer
	return m.transition(StateConfirmUninstallK3s, false)
}

func (m Model) updateConfirmUninstallK3sState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}

	switch strings.ToLower(keyMsg.String()) {
	case "u":
		if !m.k3sIsUnbindServer {
			return m, nil
		}
		return m.transition(StateUpdatingNode, true, m.updateNodeCommand())
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

func (m Model) updateUpdatingNodeState(msg tea.Msg) (Model, tea.Cmd) {
	result, ok := msg.(nodeUpdateCompleteMsg)
	if !ok {
		return m, nil
	}
	if result.err != nil {
		return m.fail(result.err)
	}
	return m.transition(StateNodeUpdated, false)
}

func (m Model) updateNodeUpdatedState(msg tea.Msg) (Model, tea.Cmd) {
	if _, ok := msg.(tea.KeyMsg); !ok {
		return m, nil
	}
	return m, tea.Quit
}
