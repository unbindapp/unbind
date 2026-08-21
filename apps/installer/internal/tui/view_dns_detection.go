package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

func viewDetectingIPs(m Model) string {
	s := strings.Builder{}
	s.WriteString(m.spinner.View())
	s.WriteString(m.styles.Bold.Render("Detecting your network configuration..."))
	s.WriteString("\n\n")
	s.WriteString(renderOSLine(m))
	s.WriteString(renderRecentLogs(m, "Network Detection:", 5))
	return renderPage(m, s.String())
}

func (m Model) updateDetectingIPsState(msg tea.Msg) (Model, tea.Cmd) {
	result, ok := msg.(detectIPsCompleteMsg)
	if !ok {
		return m, nil
	}

	m.state = StateDNSConfig
	m.isLoading = false
	if result.ipInfo != nil {
		m.dnsInfo.InternalIP = result.ipInfo.InternalIP
		m.dnsInfo.ExternalIP = result.ipInfo.ExternalIP
	}
	return m, m.domainInput.Focus()
}
