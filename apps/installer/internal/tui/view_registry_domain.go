package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// viewRegistryDomainInput shows the registry domain configuration screen
func viewRegistryDomainInput(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Instructions
	s.WriteString(m.styles.Bold.Render("Configure Registry Domain for Unbind"))
	s.WriteString("\n\n")

	// Display detected IP addresses
	if m.dnsInfo != nil {
		if m.dnsInfo.ExternalIP != "" {
			s.WriteString(m.styles.Bold.Render("External IP: "))
			s.WriteString(m.styles.Key.Render(m.dnsInfo.ExternalIP))
			s.WriteString("\n\n")
		}
	}

	// Main domain information
	if m.dnsInfo.IsWildcard {
		s.WriteString(m.styles.Bold.Render("Wildcard Domain: "))
		s.WriteString(m.styles.Normal.Render(m.dnsInfo.Domain))
	} else {
		s.WriteString(m.styles.Bold.Render("Main Domain: "))
		s.WriteString(m.styles.Normal.Render(m.dnsInfo.UnbindDomain))
	}
	s.WriteString("\n\n")

	// Registry Domain Configuration instructions
	registryText1 := "Unbind needs a registry domain that points to your server."
	for _, line := range wrapText(registryText1, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	registryText2 := "This domain must resolve directly to your external IP without any proxying."
	for _, line := range wrapText(registryText2, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("Required DNS Configuration:"))
	s.WriteString("\n")

	dnsText := "Create an 'A' record for your registry domain → " + m.dnsInfo.ExternalIP
	for _, line := range wrapText(dnsText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	cfText := "If using Cloudflare, make sure proxy is disabled (grey cloud) for this domain."
	for _, line := range wrapText(cfText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Registry Domain input field with suggestion
	if m.dnsInfo.IsWildcard {
		m.registryInput.Placeholder = "unbind-registry." + strings.TrimPrefix(m.dnsInfo.Domain, "*.")
	} else {
		m.registryInput.Placeholder = "registry." + m.dnsInfo.UnbindDomain
	}

	inputWidth := maxWidth - 8 // Account for border and padding
	if inputWidth < 20 {
		inputWidth = 20
	}

	registryInput := createStyledBox(
		fmt.Sprintf("Registry Domain: %s", m.registryInput.View()),
		lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#009900")).
			Padding(0, 1),
		inputWidth,
	)

	s.WriteString(registryInput)
	s.WriteString("\n")

	placeholderText := "Enter your registry domain (e.g. registry.yourdomain.com)"
	for _, line := range wrapText(placeholderText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Navigation hints
	s.WriteString(m.styles.Bold.Render("Navigation:"))
	s.WriteString("\n")

	navHints := []string{
		"• Press Enter to validate domain",
		"• Press Ctrl+b to go back to registry type selection",
	}

	for _, hint := range navHints {
		for _, line := range wrapText(hint, maxWidth) {
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}
	}
	s.WriteString("\n")

	// Status bar at the bottom
	s.WriteString(m.styles.StatusBar.Render("Press Ctrl+c to quit"))

	return renderWithLayout(m, s.String())
}

// updateRegistryDomainInputState handles updates in the registry domain input state
func (m Model) updateRegistryDomainInputState(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	// Check if back button was pressed
	if keyMsg, ok := msg.(tea.KeyMsg); ok && keyMsg.String() == "ctrl+b" {
		// Go back to registry type selection
		m.state = StateRegistryTypeSelection
		return m, m.listenForLogs()
	}

	// Handle text input updates
	m.registryInput, cmd = m.registryInput.Update(msg)

	// Store the registry domain value
	if m.dnsInfo == nil {
		m.dnsInfo = &dnsInfo{}
	}
	m.dnsInfo.RegistryDomain = m.registryInput.Value()

	// If Enter was pressed with a valid domain, start validation
	if keyMsg, ok := msg.(tea.KeyMsg); ok && keyMsg.String() == "enter" {
		if m.dnsInfo.RegistryDomain != "" {
			m.state = StateRegistryDNSValidation
			m.isLoading = true
			m.dnsInfo.ValidationStarted = true
			m.dnsInfo.TestingStartTime = time.Now()

			return m, tea.Batch(
				m.spinner.Tick,
				m.startRegistryDNSValidation(),
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

// viewRegistryDNSValidation shows the registry DNS validation screen
func viewRegistryDNSValidation(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Show current action
	s.WriteString(m.spinner.View())
	s.WriteString(" ")
	s.WriteString(m.styles.Bold.Render("Validating Registry Domain..."))
	s.WriteString("\n\n")

	// Display what we're testing
	s.WriteString(m.styles.Bold.Render("Testing:"))
	s.WriteString("\n")

	regLine := fmt.Sprintf("• Registry Domain: %s", m.dnsInfo.RegistryDomain)
	for _, line := range wrapText(regLine, maxWidth-2) {
		s.WriteString("  ")
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	ipLine := fmt.Sprintf("• Expected IP: %s", m.dnsInfo.ExternalIP)
	for _, line := range wrapText(ipLine, maxWidth-2) {
		s.WriteString("  ")
		s.WriteString(m.styles.Key.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	dnsNote1 := "DNS changes can take up to 24-48 hours to propagate worldwide,"
	for _, line := range wrapText(dnsNote1, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	dnsNote2 := "though they often take effect within minutes."
	for _, line := range wrapText(dnsNote2, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Process logs
	if len(m.logMessages) > 0 {
		s.WriteString(m.styles.Bold.Render("Validation Logs:"))
		s.WriteString("\n")

		// Show the last few log messages
		startIdx := 0
		if len(m.logMessages) > 8 {
			startIdx = len(m.logMessages) - 8
		}

		for _, msg := range m.logMessages[startIdx:] {
			// Use text wrapping instead of simple truncation
			msgLines := wrapText(msg, maxWidth-1)
			for _, line := range msgLines {
				s.WriteString(" ")
				s.WriteString(m.styles.Subtle.Render(line))
				s.WriteString("\n")
			}
		}
	}

	// Status bar at the bottom
	s.WriteString("\n")
	s.WriteString(m.styles.StatusBar.Render("Press Ctrl+c to quit"))

	return renderWithLayout(m, s.String())
}

// updateRegistryDNSValidationState handles updates in the registry DNS validation state
func (m Model) updateRegistryDNSValidationState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, tea.Batch(cmd, m.listenForLogs())

	case dnsValidationCompleteMsg:
		m.dnsInfo.ValidationSuccess = msg.success
		m.dnsInfo.CloudflareDetected = msg.cloudflare
		m.dnsInfo.ValidationDuration = time.Since(m.dnsInfo.TestingStartTime)

		if msg.success {
			// If registry validation is successful, proceed to success state
			m.state = StateDNSSuccess
			m.isLoading = false

			// Schedule automatic advancement after 1 second
			return m, tea.Batch(
				m.listenForLogs(),
				tea.Tick(1*time.Second, func(time.Time) tea.Msg {
					return autoAdvanceMsg{}
				}),
			)
		} else {
			// If validation fails, go back to registry input
			m.state = StateRegistryDomainInput
			m.isLoading = false
			m.logChan <- "Please try a different registry domain"

			// Clear registry domain to force re-entry
			m.dnsInfo.RegistryDomain = ""
			m.registryInput.SetValue("")
			m.registryInput.Focus()

			return m, m.listenForLogs()
		}

	case dnsValidationTimeoutMsg:
		m.dnsInfo.ValidationDuration = time.Since(m.dnsInfo.TestingStartTime)
		m.state = StateRegistryDomainInput
		m.isLoading = false
		m.logChan <- "Registry domain validation timed out, please try again"

		// Clear registry domain to force re-entry
		m.dnsInfo.RegistryDomain = ""
		m.registryInput.SetValue("")
		m.registryInput.Focus()

		return m, m.listenForLogs()

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, m.listenForLogs()
	}

	return m, m.listenForLogs()
}
