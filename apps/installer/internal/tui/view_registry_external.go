package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/unbindapp/unbind-installer/internal/utils"
)

// viewRegistryTypeSelection shows a view for selecting registry type
func viewRegistryTypeSelection(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Instructions
	s.WriteString(m.styles.Bold.Render("Select Registry Type for Unbind"))
	s.WriteString("\n\n")

	instructionText := "Unbind requires a container registry to store Docker images. You can:"
	for _, line := range wrapText(instructionText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Option 1: Self-hosted
	s.WriteString(m.styles.Bold.Render("1. Self-hosted Registry"))
	s.WriteString("\n")
	option1Text := "   Allow Unbind to install a registry on your server"
	for _, line := range wrapText(option1Text, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	option1Note := "   - Requires DNS name pointing to your server"
	for _, line := range wrapText(option1Note, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Option 2: External registry
	s.WriteString(m.styles.Bold.Render("2. External Registry"))
	s.WriteString("\n")
	option2Text := "   Use Docker Hub, GHCR, Quay, or another registry service"
	for _, line := range wrapText(option2Text, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	option2Note := "   - Requires existing account credentials"
	for _, line := range wrapText(option2Note, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Navigation hints
	s.WriteString(m.styles.Bold.Render("Navigation:"))
	s.WriteString("\n")
	s.WriteString(m.styles.Normal.Render("• Press "))
	s.WriteString(m.styles.Key.Render("1"))
	s.WriteString(m.styles.Normal.Render(" for Self-hosted Registry"))
	s.WriteString("\n")
	s.WriteString(m.styles.Normal.Render("• Press "))
	s.WriteString(m.styles.Key.Render("2"))
	s.WriteString(m.styles.Normal.Render(" for External Registry"))
	s.WriteString("\n")
	s.WriteString(m.styles.Normal.Render("• Press "))
	s.WriteString(m.styles.Key.Render("Ctrl+b"))
	s.WriteString(m.styles.Normal.Render(" to go back to DNS configuration"))
	s.WriteString("\n\n")

	// Status bar at the bottom
	s.WriteString(m.styles.StatusBar.Render("Press Ctrl+c to quit"))

	return renderWithLayout(m, s.String())
}

// updateRegistryTypeSelectionState handles selection of registry type
func (m Model) updateRegistryTypeSelectionState(msg tea.Msg) (tea.Model, tea.Cmd) {
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		case "1":
			// Self-hosted registry selected
			if m.dnsInfo == nil {
				m.dnsInfo = &dnsInfo{}
			}
			m.dnsInfo.RegistryType = RegistrySelfHosted
			m.dnsInfo.DisableLocalRegistry = false
			m.state = StateRegistryDomainInput
			m.registryInput.Focus()
			return m, m.listenForLogs()

		case "2":
			// External registry selected
			if m.dnsInfo == nil {
				m.dnsInfo = &dnsInfo{}
			}
			m.dnsInfo.RegistryType = RegistryExternal
			m.dnsInfo.DisableLocalRegistry = true
			m.state = StateExternalRegistryInput
			m.usernameInput.Focus()
			return m, m.listenForLogs()

		case "ctrl+b":
			// Go back to DNS configuration
			m.state = StateDNSConfig
			m.domainInput.Focus()
			return m, m.listenForLogs()
		}
	}

	if _, ok := msg.(tea.WindowSizeMsg); ok {
		// Handle window size changes
		return m, m.listenForLogs()
	}

	return m, m.listenForLogs()
}

// viewExternalRegistryInput shows the input screen for external registry credentials
func viewExternalRegistryInput(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Instructions
	s.WriteString(m.styles.Bold.Render("Enter External Registry Credentials"))
	s.WriteString("\n\n")

	instructionText := "Please select a registry and enter your credentials:"
	for _, line := range wrapText(instructionText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Registry selection
	s.WriteString(m.styles.Bold.Render("Select Registry:"))
	s.WriteString("\n")

	// Docker Hub
	if m.selectedRegistry == 0 {
		s.WriteString(m.styles.SelectedOption.Render("→ [F1] Docker Hub (docker.io)"))
	} else {
		s.WriteString(m.styles.Normal.Render("  [F1] Docker Hub (docker.io)"))
	}
	s.WriteString("\n")

	// GitHub Container Registry
	if m.selectedRegistry == 1 {
		s.WriteString(m.styles.SelectedOption.Render("→ [F2] GitHub Container Registry (ghcr.io)"))
	} else {
		s.WriteString(m.styles.Normal.Render("  [F2] GitHub Container Registry (ghcr.io)"))
	}
	s.WriteString("\n")

	// Red Hat Quay
	if m.selectedRegistry == 2 {
		s.WriteString(m.styles.SelectedOption.Render("→ [F3] Red Hat Quay (quay.io)"))
	} else {
		s.WriteString(m.styles.Normal.Render("  [F3] Red Hat Quay (quay.io)"))
	}
	s.WriteString("\n")

	// Custom Registry
	if m.selectedRegistry == 3 {
		s.WriteString(m.styles.SelectedOption.Render("→ [F4] Custom Registry"))
	} else {
		s.WriteString(m.styles.Normal.Render("  [F4] Custom Registry"))
	}
	s.WriteString("\n\n")

	// Custom registry field if selected
	if m.selectedRegistry == 3 {
		inputWidth := maxWidth - 8 // Account for border and padding
		if inputWidth < 20 {
			inputWidth = 20
		}

		customRegistryInput := createStyledBox(
			fmt.Sprintf("Registry Host: %s", m.registryHostInput.View()),
			lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("#009900")).
				Padding(0, 1),
			inputWidth,
		)

		s.WriteString(customRegistryInput)
		s.WriteString("\n\n")
	}

	// Show current registry
	s.WriteString(m.styles.Bold.Render("Registry: "))
	var registryHost string
	switch m.selectedRegistry {
	case 0:
		registryHost = "docker.io"
	case 1:
		registryHost = "ghcr.io"
	case 2:
		registryHost = "quay.io"
	case 3:
		registryHost = m.registryHostInput.Value()
		if registryHost == "" {
			registryHost = "registry.example.com"
		}
	}
	s.WriteString(m.styles.Normal.Render(getRegistryDisplayName(registryHost)))
	s.WriteString("\n\n")

	// Username input field
	inputWidth := maxWidth - 8 // Account for border and padding
	if inputWidth < 20 {
		inputWidth = 20
	}

	usernameInput := createStyledBox(
		fmt.Sprintf("Username: %s", m.usernameInput.View()),
		lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#009900")).
			Padding(0, 1),
		inputWidth,
	)

	s.WriteString(usernameInput)
	s.WriteString("\n\n")

	// Password input field
	passwordInput := createStyledBox(
		fmt.Sprintf("Password: %s", m.passwordInput.View()),
		lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#009900")).
			Padding(0, 1),
		inputWidth,
	)

	s.WriteString(passwordInput)
	s.WriteString("\n\n")

	validationText := "We'll validate these credentials before proceeding"
	for _, line := range wrapText(validationText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Navigation hints
	s.WriteString(m.styles.Bold.Render("Navigation:"))
	s.WriteString("\n")

	navHints := []string{
		"• Press Tab to switch between fields",
		"• Press F1 through F4 to select registry type",
		"• Press Enter to validate credentials",
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

// updateExternalRegistryInputState handles updates in the external registry input state
func (m Model) updateExternalRegistryInputState(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	// Check if back button was pressed
	if keyMsg, ok := msg.(tea.KeyMsg); ok && keyMsg.String() == "ctrl+b" {
		// Go back to registry type selection
		m.state = StateRegistryTypeSelection
		return m, m.listenForLogs()
	}

	// Check for registry selection keys
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		case "f1":
			// Docker Hub
			m.selectedRegistry = 0
		case "f2":
			// GitHub Container Registry
			m.selectedRegistry = 1
		case "f3":
			// Red Hat Quay
			m.selectedRegistry = 2
		case "f4":
			// Custom Registry
			m.selectedRegistry = 3
		}
	}

	// Check if tab was pressed
	if keyMsg, ok := msg.(tea.KeyMsg); ok && keyMsg.String() == "tab" {
		// Toggle focus between inputs
		if m.selectedRegistry == 3 {
			// Custom registry has 3 fields
			if m.registryHostInput.Focused() {
				m.registryHostInput.Blur()
				m.usernameInput.Focus()
			} else if m.usernameInput.Focused() {
				m.usernameInput.Blur()
				m.passwordInput.Focus()
			} else {
				m.passwordInput.Blur()
				m.registryHostInput.Focus()
			}
		} else {
			// Other registries have 2 fields
			if m.usernameInput.Focused() {
				m.usernameInput.Blur()
				m.passwordInput.Focus()
			} else {
				m.passwordInput.Blur()
				m.usernameInput.Focus()
			}
		}
		return m, nil
	}

	// Update the focused input
	if m.registryHostInput.Focused() {
		m.registryHostInput, cmd = m.registryHostInput.Update(msg)
	} else if m.usernameInput.Focused() {
		m.usernameInput, cmd = m.usernameInput.Update(msg)
	} else {
		m.passwordInput, cmd = m.passwordInput.Update(msg)
	}

	// Store the values
	if m.dnsInfo == nil {
		m.dnsInfo = &dnsInfo{}
	}
	m.dnsInfo.RegistryUsername = m.usernameInput.Value()
	m.dnsInfo.RegistryPassword = m.passwordInput.Value()

	// Set registry host based on selection
	switch m.selectedRegistry {
	case 0:
		m.dnsInfo.RegistryHost = "docker.io"
	case 1:
		m.dnsInfo.RegistryHost = "ghcr.io"
	case 2:
		m.dnsInfo.RegistryHost = "quay.io"
	case 3:
		m.dnsInfo.RegistryHost = m.registryHostInput.Value()
	}

	// If Enter was pressed, handle tabbing or submission
	if keyMsg, ok := msg.(tea.KeyMsg); ok && keyMsg.String() == "enter" {
		if m.selectedRegistry == 3 {
			// Custom registry: 3 fields
			if m.registryHostInput.Focused() {
				// Move to username
				m.registryHostInput.Blur()
				m.usernameInput.Focus()
				return m, nil
			} else if m.usernameInput.Focused() {
				// Move to password
				m.usernameInput.Blur()
				m.passwordInput.Focus()
				return m, nil
			} else if m.passwordInput.Focused() {
				// Only submit if all fields are filled
				if m.dnsInfo.RegistryUsername != "" && m.dnsInfo.RegistryPassword != "" && m.dnsInfo.RegistryHost != "" {
					m.state = StateExternalRegistryValidation
					m.isLoading = true
					m.dnsInfo.TestingStartTime = time.Now()
					return m, tea.Batch(
						m.spinner.Tick,
						m.validateRegistryCredentials(),
						m.listenForLogs(),
					)
				}
				return m, m.listenForLogs()
			}
		} else {
			// Other registries: 2 fields
			if m.usernameInput.Focused() {
				// Move to password
				m.usernameInput.Blur()
				m.passwordInput.Focus()
				return m, nil
			} else if m.passwordInput.Focused() {
				if m.dnsInfo.RegistryUsername != "" && m.dnsInfo.RegistryPassword != "" {
					m.state = StateExternalRegistryValidation
					m.isLoading = true
					m.dnsInfo.TestingStartTime = time.Now()
					return m, tea.Batch(
						m.spinner.Tick,
						m.validateRegistryCredentials(),
						m.listenForLogs(),
					)
				}
				return m, m.listenForLogs()
			}
		}
	}

	if _, ok := msg.(tea.WindowSizeMsg); ok {
		// Handle window size changes
		return m, tea.Batch(cmd, m.listenForLogs())
	}

	// For any other message, keep updating the input and listening for logs
	return m, tea.Batch(cmd, m.listenForLogs())
}

// viewExternalRegistryValidation shows validation of external registry credentials
func viewExternalRegistryValidation(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getBanner(m))
	s.WriteString("\n\n")

	// Show current action
	s.WriteString(m.spinner.View())
	s.WriteString(" ")
	s.WriteString(m.styles.Bold.Render("Validating Registry Credentials..."))
	s.WriteString("\n\n")

	// Display what we're testing
	s.WriteString(m.styles.Bold.Render("Verifying:"))
	s.WriteString("\n")
	s.WriteString(fmt.Sprintf("  • Username: %s\n", m.styles.Normal.Render(m.dnsInfo.RegistryUsername)))
	s.WriteString(fmt.Sprintf("  • Registry: %s\n", m.styles.Normal.Render(getRegistryDisplayName(m.dnsInfo.RegistryHost))))
	s.WriteString("\n")

	// Process logs
	if len(m.logMessages) > 0 {
		s.WriteString(m.styles.Bold.Render("Connection logs:"))
		s.WriteString("\n")

		// Show the last few log messages
		startIdx := 0
		if len(m.logMessages) > 8 {
			startIdx = len(m.logMessages) - 8
		}

		for _, msg := range m.logMessages[startIdx:] {
			// Truncate the message if it's too long
			const maxLength = 80 // Reasonable terminal width

			displayMsg := msg
			if len(msg) > maxLength {
				displayMsg = msg[:maxLength-3] + "..."
			}

			s.WriteString(fmt.Sprintf(" %s\n", m.styles.Subtle.Render(displayMsg)))
		}
	}

	// Status bar at the bottom
	s.WriteString("\n")
	s.WriteString(m.styles.StatusBar.Render("Press Ctrl+c to quit"))

	return s.String()
}

// updateExternalRegistryValidationState handles updates in the external registry validation state
func (m Model) updateExternalRegistryValidationState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, tea.Batch(cmd, m.listenForLogs())

	case registryValidationCompleteMsg:
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
			m.state = StateExternalRegistryInput
			m.isLoading = false
			m.logChan <- "Registry credentials validation failed. Please try again."

			// Focus username field
			m.usernameInput.Focus()

			return m, m.listenForLogs()
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, m.listenForLogs()
	}

	return m, m.listenForLogs()
}

// getRegistryDisplayName returns a user-friendly display name for registry hosts
func getRegistryDisplayName(host string) string {
	switch host {
	case "docker.io":
		return "Docker Hub"
	case "ghcr.io":
		return "GitHub Container Registry"
	case "quay.io":
		return "Red Hat Quay"
	default:
		return host
	}
}

// initializeDomainInput initializes the text input for domain entry
func initializeDomainInput() textinput.Model {
	ti := textinput.New()
	ti.Placeholder = "yourdomain.com"
	ti.Focus()
	ti.Width = 30
	ti.Validate = func(s string) error {
		// Handle wildcard domain
		if strings.HasPrefix(s, "*.") {
			baseDomain := strings.TrimPrefix(s, "*.")
			if !utils.IsDNSName(baseDomain) {
				return fmt.Errorf("%s is not a valid domain", baseDomain)
			}
			return nil
		}

		// Handle regular domain
		if !utils.IsDNSName(s) {
			return fmt.Errorf("%s is not a valid domain", s)
		}
		return nil
	}
	ti.PromptStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#009900"))
	return ti
}

// initializeRegistryInput initializes the text input for registry domain entry
func initializeRegistryInput() textinput.Model {
	ti := textinput.New()
	ti.Placeholder = "registry.yourdomain.com"
	ti.Width = 30
	ti.Validate = func(s string) error {
		// Handle regular domain
		if !utils.IsDNSName(s) {
			return fmt.Errorf("%s is not a valid domain", s)
		}
		return nil
	}
	ti.PromptStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#009900"))
	return ti
}

// initializeUsernameInput initializes the text input for registry username entry
func initializeUsernameInput() textinput.Model {
	ti := textinput.New()
	ti.Placeholder = "username"
	ti.Width = 30
	ti.PromptStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#009900"))
	return ti
}

// initializePasswordInput initializes the text input for registry password entry
func initializePasswordInput() textinput.Model {
	ti := textinput.New()
	ti.Placeholder = "password"
	ti.Width = 30
	ti.EchoMode = textinput.EchoPassword
	ti.PromptStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#009900"))
	return ti
}
