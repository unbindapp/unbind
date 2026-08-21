package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

func viewWelcome(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Bold.Render("Requirements:"))
	s.WriteString("\n")
	requirements := []string{
		"Port 80 and 443 accessible, if using a firewall",
		"A domain pointing to the server IP",
	}
	for i, req := range requirements {
		writeListItem(&s, m, m.styles.Success.Render(fmt.Sprintf("%d.", i+1)), req, maxWidth)
	}
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("We'll install these:"))
	s.WriteString("\n")
	writeWrapped(&s, m.styles.Subtle, "(most of these are automatically managed by Unbind)", maxWidth)
	components := []string{
		"k3s - Lightweight Kubernetes",
		"registry - Private Docker registry",
		"monitoring - Monitoring stack (Prometheus, Metrics Exporters)",
		"logging - Indexed logging (Alloy, Loki)",
		"buildkitd - Docker BuildKit daemon",
		"Unbind - All Unbind components",
	}
	bullet := m.styles.Key.Render("•")
	for _, item := range components {
		writeListItem(&s, m, bullet, item, maxWidth)
	}
	s.WriteString("\n")

	s.WriteString(continueButton(m))
	s.WriteString("\n\n")
	s.WriteString(centered(m, quitHint(m)))
	return renderPage(m, s.String())
}

func writeListItem(s *strings.Builder, m Model, marker, text string, width int) {
	indent := strings.Repeat(" ", lipgloss.Width(marker)+1)
	for i, line := range wrapText(text, width-len(indent)) {
		if i == 0 {
			s.WriteString(marker + " ")
		} else {
			s.WriteString(indent)
		}
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
}

func (m Model) updateWelcomeState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, ok := msg.(tea.KeyMsg)
	if !ok || keyMsg.String() != "enter" {
		return m, nil
	}
	return m.transition(StateCheckK3s, true, checkK3sCommand())
}
