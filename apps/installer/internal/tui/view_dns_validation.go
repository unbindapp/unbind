package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
)

// viewDNSValidation shows the DNS validation screen
func viewDNSValidation(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Show current action
	s.WriteString(m.spinner.View())
	s.WriteString(" ")
	s.WriteString(m.styles.Bold.Render("Validating DNS configuration..."))
	s.WriteString("\n\n")

	// Display what we're testing
	s.WriteString(m.styles.Bold.Render("Testing:"))
	s.WriteString("\n")

	if m.dnsInfo.IsWildcard {
		testLine := fmt.Sprintf("• Wildcard: %s", m.dnsInfo.Domain)
		for _, line := range wrapText(testLine, maxWidth-2) {
			s.WriteString("  ")
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}
	} else {
		testLine := fmt.Sprintf("• Domain: %s", m.dnsInfo.Domain)
		for _, line := range wrapText(testLine, maxWidth-2) {
			s.WriteString("  ")
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}
	}

	unbindLine := fmt.Sprintf("• Unbind: %s", m.dnsInfo.UnbindDomain)
	for _, line := range wrapText(unbindLine, maxWidth-2) {
		s.WriteString("  ")
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	registryLine := "• Registry: " + registrySummary(m)
	for _, line := range wrapText(registryLine, maxWidth-2) {
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

// updateDNSValidationState handles updates in the DNS validation state
func (m Model) updateDNSValidationState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, tea.Batch(cmd, m.listenForLogs())

	case dnsValidationCompleteMsg:
		m.dnsInfo.ValidationSuccess = msg.success
		m.dnsInfo.CloudflareDetected = msg.cloudflare
		m.dnsInfo.MainResolved = msg.mainResolved
		m.dnsInfo.MainResolvedIP = msg.mainResolvedIP
		m.dnsInfo.ValidationDuration = time.Since(m.dnsInfo.TestingStartTime)

		if msg.success {
			// Everything checks out; show the summary, then install.
			m.state = StateDNSSuccess
			m.isLoading = false
			m.logChan <- "Configuration validated successfully."
			return m, tea.Batch(
				m.listenForLogs(),
				tea.Tick(1*time.Second, func(time.Time) tea.Msg {
					return autoAdvanceMsg{}
				}),
			)
		}

		m.state = StateDNSFailed
		m.isLoading = false
		return m, m.listenForLogs()

	case dnsValidationTimeoutMsg:
		m.dnsInfo.ValidationDuration = time.Since(m.dnsInfo.TestingStartTime)
		m.state = StateDNSFailed
		m.isLoading = false
		m.logChan <- "DNS validation timed out after 30 seconds"
		return m, m.listenForLogs()

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, m.listenForLogs()
	}

	return m, m.listenForLogs()
}

// viewDNSSuccess shows the DNS success screen
func viewDNSSuccess(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Success message
	s.WriteString(m.styles.Success.Render("✓ Configuration Successful!"))
	s.WriteString("\n\n")

	// DNS Configuration details
	s.WriteString(m.styles.Bold.Render("DNS Configuration:"))
	s.WriteString("\n")

	if m.dnsInfo.CloudflareDetected {
		cfLine := "• Cloudflare detected: Yes"
		for _, line := range wrapText(cfLine, maxWidth) {
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}

		var configText string
		if m.dnsInfo.IsWildcard {
			configText = "• Wildcard domain configured correctly with Cloudflare"
		} else {
			configText = "• Domains configured correctly with Cloudflare"
		}

		for _, line := range wrapText(configText, maxWidth) {
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}
	} else {
		s.WriteString(m.styles.Bold.Render("Configured domains:"))
		s.WriteString("\n")

		unbindLine := "• " + m.dnsInfo.UnbindDomain
		for _, line := range wrapText(unbindLine, maxWidth) {
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}

		if m.dnsInfo.IsWildcard {
			wildcardLine := "• " + m.dnsInfo.Domain + " (wildcard)"
			for _, line := range wrapText(wildcardLine, maxWidth) {
				s.WriteString(m.styles.Normal.Render(line))
				s.WriteString("\n")
			}
		}

		s.WriteString(m.styles.Bold.Render("Points to: "))
		s.WriteString(m.styles.Normal.Render(m.dnsInfo.ExternalIP))
		s.WriteString("\n")
	}

	// Registry Configuration details
	s.WriteString("\n\n")
	s.WriteString(m.styles.Bold.Render("Registry Configuration:"))
	s.WriteString("\n")

	if m.dnsInfo.RegistryType == RegistrySelfHosted {
		regText1 := "• Self-hosted registry (in-cluster, no domain required)"
		for _, line := range wrapText(regText1, maxWidth) {
			s.WriteString(m.styles.Success.Render(line))
			s.WriteString("\n")
		}

		regText2 := "• Registry will be deployed as part of Unbind installation"
		for _, line := range wrapText(regText2, maxWidth) {
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}
	} else {
		regText1 := "• External registry configured:"
		for _, line := range wrapText(regText1, maxWidth) {
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}

		regText2 := fmt.Sprintf("  %s account: %s",
			getRegistryDisplayName(m.dnsInfo.RegistryHost),
			m.dnsInfo.RegistryUsername)
		for _, line := range wrapText(regText2, maxWidth) {
			s.WriteString(m.styles.Success.Render(line))
			s.WriteString("\n")
		}

		regText3 := "• Local registry component will be disabled"
		for _, line := range wrapText(regText3, maxWidth) {
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}
	}

	// Validation details
	s.WriteString("\n\n")
	validationText := fmt.Sprintf("Validation completed in %.1f seconds", m.dnsInfo.ValidationDuration.Seconds())
	for _, line := range wrapText(validationText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	completeText := "Your configuration is complete and Unbind can proceed with installation."
	for _, line := range wrapText(completeText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Continue button
	continueText := " Press Enter to continue "
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

	return renderWithLayout(m, s.String())
}

// startInstall begins the headless install chain (swap → packages → k3s →
// unbind). Configuration is already gathered and validated at this point, so
// nothing below prompts the user.
func (m Model) startInstall() (tea.Model, tea.Cmd) {
	m.state = StateCheckingSwap
	m.isLoading = true
	return m, tea.Batch(
		m.spinner.Tick,
		m.checkSwapCommand(),
		m.listenForLogs(),
	)
}

func (m Model) updateDNSSuccessState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "enter" {
			return m.startInstall()
		}
	case autoAdvanceMsg:
		return m.startInstall()
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}

	return m, m.listenForLogs()
}

// writeCheckResult renders a single pass/fail line with resolved-vs-expected
// detail underneath when the check failed.
func writeCheckResult(s *strings.Builder, m Model, label, target string, ok bool, resolvedIP, expectedIP string) {
	if ok {
		s.WriteString(m.styles.Success.Render("  ✓ " + label + ": " + target))
		s.WriteString("\n")
		return
	}

	s.WriteString(m.styles.Error.Render("  ✗ " + label + ": " + target))
	s.WriteString("\n")
	resolved := resolvedIP
	if resolved == "" {
		resolved = "(no record found)"
	}
	s.WriteString(m.styles.Subtle.Render("     resolved to: " + resolved))
	s.WriteString("\n")
	s.WriteString(m.styles.Subtle.Render("     expected:    " + expectedIP))
	s.WriteString("\n")
}

// viewDNSFailed shows the configuration validation failure screen
func viewDNSFailed(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getBanner(m))
	s.WriteString("\n\n")

	// Error message
	s.WriteString(m.styles.Error.Render("! Configuration Validation Failed"))
	s.WriteString("\n\n")

	// Per-check breakdown
	s.WriteString(m.styles.Bold.Render("Checks:"))
	s.WriteString("\n")

	mainTarget := m.dnsInfo.UnbindDomain
	if m.dnsInfo.IsWildcard {
		mainTarget = m.dnsInfo.Domain + " (wildcard)"
	}
	writeCheckResult(&s, m, "Domain", mainTarget, m.dnsInfo.MainResolved, m.dnsInfo.MainResolvedIP, m.dnsInfo.ExternalIP)

	// The self-hosted registry is in-cluster with nothing to validate, so only the
	// external-registry credential check can fail here.
	if m.dnsInfo.RegistryType == RegistryExternal {
		s.WriteString(m.styles.Error.Render("  ✗ Registry credentials: " + getRegistryDisplayName(m.dnsInfo.RegistryHost)))
		s.WriteString("\n")
		s.WriteString(m.styles.Subtle.Render("     could not authenticate as " + m.dnsInfo.RegistryUsername))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Validation details
	s.WriteString(m.styles.Subtle.Render(fmt.Sprintf("Validation attempted for %.1f seconds", m.dnsInfo.ValidationDuration.Seconds())))
	s.WriteString("\n")
	s.WriteString(m.styles.Subtle.Render("DNS changes can take a few minutes (occasionally up to 24-48 hours) to propagate."))
	s.WriteString("\n\n")

	// Options
	s.WriteString(m.styles.Bold.Render("Options:"))
	s.WriteString("\n")
	s.WriteString(m.styles.Normal.Render("• Press Ctrl+r to retry validation"))
	s.WriteString("\n")
	s.WriteString(m.styles.Normal.Render("• Press Ctrl+e to edit the domain"))
	s.WriteString("\n")
	s.WriteString(m.styles.Normal.Render("• Press Ctrl+g to edit the registry"))
	s.WriteString("\n")
	s.WriteString(m.styles.Normal.Render("• Press Enter to continue anyway (not recommended)"))
	s.WriteString("\n\n")

	// Status bar at the bottom
	s.WriteString(m.styles.StatusBar.Render("Press Ctrl+c to quit"))

	return s.String()
}

// updateDNSFailedState handles updates in the DNS failed state
func (m Model) updateDNSFailedState(msg tea.Msg) (tea.Model, tea.Cmd) {
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		case "enter":
			// Continue anyway despite validation failure and start the install.
			m.logChan <- "Continuing without validated configuration..."
			return m.startInstall()

		case "ctrl+r":
			// Re-run the combined validation pass.
			m.logChan <- "Retrying validation..."
			return m.startConfigValidation()

		case "ctrl+e":
			// Edit the domain.
			m.state = StateDNSConfig
			m.isLoading = false
			m.domainInput.SetValue(m.dnsInfo.Domain)
			m.domainInput.Focus()
			return m, m.listenForLogs()

		case "ctrl+g":
			// Edit the registry configuration.
			m.isLoading = false
			if m.dnsInfo.RegistryType == RegistryExternal {
				m.state = StateExternalRegistryInput
				m.usernameInput.Focus()
			} else {
				// Self-hosted has nothing to edit; return to the type selection.
				m.state = StateRegistryTypeSelection
			}
			return m, m.listenForLogs()
		}
	}

	if msg, ok := msg.(tea.WindowSizeMsg); ok {
		m.width = msg.Width
		m.height = msg.Height
	}

	return m, m.listenForLogs()
}

// registrySummary describes the chosen registry for the validation summary screen.
func registrySummary(m Model) string {
	if m.dnsInfo.RegistryType == RegistryExternal {
		return getRegistryDisplayName(m.dnsInfo.RegistryHost)
	}
	return "self-hosted (in-cluster, no domain)"
}
