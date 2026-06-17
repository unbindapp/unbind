package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// viewMainDomainInput shows the main domain configuration screen
func viewDNSConfig(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Instructions
	s.WriteString(m.styles.Bold.Render("Configure DNS for Unbind"))
	s.WriteString("\n\n")

	// Display detected IP addresses
	if m.dnsInfo != nil {
		if m.dnsInfo.ExternalIP != "" {
			s.WriteString(m.styles.Bold.Render("External IP: "))
			s.WriteString(m.styles.Key.Render(m.dnsInfo.ExternalIP))
			s.WriteString("\n\n")
		}
	}

	// DNS Configuration instructions
	dnsText := "For Unbind to work properly, you need to configure DNS entries pointing to your external IP address."
	for _, line := range wrapText(dnsText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("Option 1 (Recommended): Create a wildcard A record"))
	s.WriteString("\n")

	option1Text := "1. Create an 'A' record for *.yourdomain.com → " + m.dnsInfo.ExternalIP
	for _, line := range wrapText(option1Text, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("Option 2: Create a standalone A record"))
	s.WriteString("\n")

	option2Text1 := "1. Create an 'A' record for yourdomain.com → " + m.dnsInfo.ExternalIP
	for _, line := range wrapText(option2Text1, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	option2Text2 := "This is the domain you'll use to access Unbind."
	for _, line := range wrapText(option2Text2, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	warningText := " Note: Not using a wildcard A record will disable automatic domain generation for unbind services"
	for _, line := range wrapText(warningText, maxWidth) {
		s.WriteString(m.styles.Warning.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Domain input field
	inputWidth := maxWidth - 8 // Account for border and padding
	if inputWidth < 20 {
		inputWidth = 20
	}

	domainInput := createStyledBox(
		fmt.Sprintf("Domain: %s", m.domainInput.View()),
		lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#009900")).
			Padding(0, 1),
		inputWidth,
	)

	s.WriteString(domainInput)
	s.WriteString("\n")

	placeholderText := "Enter your domain (e.g. yourdomain.com)"
	for _, line := range wrapText(placeholderText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Continue button
	continueText := " Press Enter to validate DNS "
	continuePrompt := m.styles.HighlightButton.Render(continueText)

	// Center the button if we have enough width
	if maxWidth > len(continueText) {
		padding := (maxWidth - len(continueText)) / 2
		if padding > 0 {
			s.WriteString(strings.Repeat(" ", padding))
		}
	}
	s.WriteString(continuePrompt)
	s.WriteString("\n\n")

	// Status bar at the bottom
	s.WriteString(m.styles.StatusBar.Render("Press Ctrl+c to quit"))

	return renderWithLayout(m, s.String())
}

func (m Model) updateDNSConfigState(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	// Handle text input updates
	m.domainInput, cmd = m.domainInput.Update(msg)

	// Store the domain value
	if m.dnsInfo == nil {
		m.dnsInfo = &dnsInfo{}
	}
	m.dnsInfo.Domain = m.domainInput.Value()

	// If Enter was pressed with a valid domain, start validation
	if keyMsg, ok := msg.(tea.KeyMsg); ok && keyMsg.String() == "enter" {
		if m.dnsInfo.Domain != "" {
			// Parse the domain and determine if it's a wildcard
			domain := m.dnsInfo.Domain
			m.dnsInfo.UnbindDomain = strings.TrimPrefix(domain, "*.")

			m.state = StateDNSValidation
			m.isLoading = true
			m.dnsInfo.ValidationStarted = true
			m.dnsInfo.TestingStartTime = time.Now()

			return m, tea.Batch(
				m.spinner.Tick,
				m.startMainDNSValidation(),
				dnsValidationTimeout(30*time.Second),
				m.listenForLogs(),
			)
		}
	}

	if _, ok := msg.(tea.WindowSizeMsg); ok {
		// Handle window size changes
		return m, tea.Batch(cmd, m.listenForLogs())
	}

	// For any other message, keep updating the input and listening for logs
	return m, tea.Batch(cmd, m.listenForLogs())
}

// dnsValidationTimeout generates a command that sends a timeout message after the specified duration
func dnsValidationTimeout(d time.Duration) tea.Cmd {
	return tea.Tick(d, func(time.Time) tea.Msg {
		return dnsValidationTimeoutMsg{}
	})
}
