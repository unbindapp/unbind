package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

// viewWelcome shows the welcome screen with installation information
func viewWelcome(m Model) string {
	s := strings.Builder{}

	// Show the banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Installation description
	description := "I will install unbind and all of its its dependencies on your system."
	for _, line := range wrapText(description, maxWidth) {
		// Center align if we have enough width
		if maxWidth > 60 {
			padding := (maxWidth - len(line)) / 2
			if padding > 0 {
				line = strings.Repeat(" ", padding) + line
			}
		}
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Requirements section
	reqTitle := m.styles.Bold.Render("Requirements:")
	s.WriteString(reqTitle)
	s.WriteString("\n")

	reqList := []string{
		"Port 80 and 443 accessible, if using a firewall",
		"A domain pointing to the server IP (I will guide you through this later!)",
	}

	for _, req := range reqList {
		// Highlight the checkmark in green
		checkmark := m.styles.Success.Render("✓")
		reqLines := wrapText(req, maxWidth-2) // Account for checkmark space
		for i, line := range reqLines {
			if i == 0 {
				s.WriteString(checkmark + " " + m.styles.Normal.Render(line))
			} else {
				s.WriteString("  " + m.styles.Normal.Render(line)) // Indent continuation lines
			}
			s.WriteString("\n")
		}
	}

	s.WriteString("\n")

	// What will be installed section
	installTitle := m.styles.Bold.Render("What will be installed")
	s.WriteString(installTitle)
	s.WriteString("\n")

	// Wrap subtitle text
	for _, line := range wrapText("(most of these are automatically managed by unbind)", maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	// Create a highlighted bullet
	bullet := m.styles.Key.Render("•")

	installList := []string{
		"k3s - Lightweight Kubernetes",
		"registry - Private Docker registry",
		"monitoring - Monitoring stack (Prometheus, Metrics Exporters)",
		"logging - Indexed logging (Alloy, Loki)",
		"buildkitd - Docker BuildKit daemon",
		"unbind - All unbind components",
	}

	for _, item := range installList {
		itemLines := wrapText(item, maxWidth-2) // Account for bullet space
		for i, line := range itemLines {
			if i == 0 {
				s.WriteString(bullet + " " + m.styles.Normal.Render(line))
			} else {
				s.WriteString("  " + m.styles.Normal.Render(line)) // Indent continuation lines
			}
			s.WriteString("\n")
		}
	}

	s.WriteString("\n")

	// Footer with continue prompt
	continueText := " Press Enter to continue "
	continuePrompt := m.styles.HighlightButton.Render(continueText)

	// Center the continue prompt if we have enough width
	if maxWidth > len(continueText) {
		padding := (maxWidth - len(continueText)) / 2
		if padding > 0 {
			s.WriteString(strings.Repeat(" ", padding))
		}
	}
	s.WriteString(continuePrompt)
	s.WriteString("\n\n")

	// Quit option
	quitText := "Press 'Ctrl+c' to quit"
	if maxWidth > len(quitText) {
		padding := (maxWidth - len(quitText)) / 2
		if padding > 0 {
			s.WriteString(strings.Repeat(" ", padding))
		}
	}
	s.WriteString(m.styles.Subtle.Render(quitText))

	return renderWithLayout(m, s.String())
}

// updateWelcomeState handles updates in the welcome state
func (m Model) updateWelcomeState(msg tea.Msg) (tea.Model, tea.Cmd) {
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		if keyMsg.String() == "enter" {
			// When Enter is pressed on the welcome screen,
			// transition to the k3s check state and start checking
			m.state = StateCheckK3s
			m.isLoading = true
			return m, tea.Batch(
				m.spinner.Tick,
				checkK3sCommand(),
				m.listenForLogs(),
			)
		}
	}

	// For any other message, just keep listening for logs
	return m, m.listenForLogs()
}
