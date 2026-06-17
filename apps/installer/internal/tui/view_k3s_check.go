package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
)

func viewCheckK3s(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	// Spinner and Action Text
	if m.isLoading {
		s.WriteString(m.spinner.View())
		s.WriteString(" ")
	}
	s.WriteString(m.styles.Bold.Render("Checking for existing K3s installation..."))
	s.WriteString("\n\n")

	// Footer / Quit message
	s.WriteString(m.styles.Subtle.Render("Press 'Ctrl+c' to quit"))

	return renderWithLayout(m, s.String())
}

func viewConfirmUninstallK3s(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Title using Warning or Error style
	title := m.styles.Error.Render("! Existing K3s Installation Found!")
	s.WriteString(title)
	s.WriteString("\n\n")

	// Description
	descText1 := "An existing K3s installation (or remnants) was detected."
	for _, line := range wrapText(descText1, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	descText2 := "To ensure a clean setup for unbind, it's recommended to uninstall the existing K3s first."
	for _, line := range wrapText(descText2, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Question with auto-uninstall countdown
	questionText := fmt.Sprintf("Uninstalling the existing K3s automatically in %d seconds...", m.uninstallCountdown)
	for _, line := range wrapText(questionText, maxWidth) {
		s.WriteString(m.styles.Bold.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Instructions / Footer
	instructionText := "Press 'y' to uninstall now, or 'n'/'Ctrl+c' to cancel and quit."
	for _, line := range wrapText(instructionText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	return renderWithLayout(m, s.String())
}

func viewUninstallingK3s(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Spinner and Action Text
	if m.isLoading {
		s.WriteString(m.spinner.View())
		s.WriteString(" ")
	}
	s.WriteString(m.styles.Bold.Render("Uninstalling existing K3s installation..."))
	s.WriteString("\n\n")

	// Footer / Quit message
	footerText := "Uninstall process started. Pressing 'Ctrl+c' will attempt to quit, but the uninstall may continue in the background."
	for _, line := range wrapText(footerText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	return renderWithLayout(m, s.String())
}

func (m Model) updateCheckK3sState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case k3sCheckResultMsg:
		m.isLoading = false // Stop loading spinner for this phase
		if msg.err != nil {
			m.err = msg.err
			m.state = StateError
			return m, m.listenForLogs()
		}

		if msg.checkResult.IsInstalled {
			// K3s found, auto-uninstall after a short countdown the user can cancel
			m.state = StateConfirmUninstallK3s
			m.k3sUninstallScriptPath = msg.checkResult.UninstallScript
			m.uninstallCountdown = 5
			return m, tea.Batch(countdownTick(), m.listenForLogs())
		}

		// K3s not found, proceed to OS detection
		m.state = StateLoading // Re-use loading state for OS info
		m.isLoading = true
		return m, tea.Batch(m.spinner.Tick, detectOSInfo, m.listenForLogs())

	case errMsg: // Handle potential errors from checkK3sCommand (like not root)
		m.isLoading = false
		m.err = msg.err
		m.state = StateError
		return m, m.listenForLogs()

	case spinner.TickMsg: // Handle spinner if still loading
		var cmd tea.Cmd
		if m.isLoading {
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
		return m, nil // Ignore tick if not loading

	case tea.KeyMsg: // Handle quit keys during check
		switch msg.String() {
		case "q":
			return m, tea.Quit
		}
	}
	return m, m.listenForLogs() // Keep listening for logs
}

func (m Model) startK3sUninstall() (tea.Model, tea.Cmd) {
	if m.k3sUninstallScriptPath == "" {
		m.err = fmt.Errorf("internal error: K3s uninstall path not found")
		m.state = StateError
		return m, m.listenForLogs()
	}
	m.state = StateUninstallingK3s
	m.isLoading = true
	return m, tea.Batch(
		m.spinner.Tick,
		m.uninstallK3sCommand(m.k3sUninstallScriptPath),
		m.listenForLogs(),
	)
}

func (m Model) updateConfirmUninstallK3sState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case countdownTickMsg:
		m.uninstallCountdown--
		if m.uninstallCountdown <= 0 {
			return m.startK3sUninstall()
		}
		return m, countdownTick()

	case tea.KeyMsg:
		switch strings.ToLower(msg.String()) {
		case "y", "enter":
			return m.startK3sUninstall()
		case "n", "q":
			return m, tea.Quit
		}
	}
	return m, m.listenForLogs()
}

func (m Model) updateUninstallingK3sState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case k3sUninstallCompleteMsg:
		m.isLoading = false // Stop spinner
		if msg.err != nil {
			// Uninstall failed
			m.err = msg.err // Display the specific uninstall error
			m.state = StateError
			return m, m.listenForLogs()
		}
		// Uninstall succeeded, proceed to OS detection
		m.state = StateLoading // Re-use loading state for OS info
		m.isLoading = true
		return m, tea.Batch(m.spinner.Tick, detectOSInfo, m.listenForLogs())

	case errMsg: // Handle potential errors during uninstall command setup
		m.isLoading = false
		m.err = msg.err
		m.state = StateError
		return m, m.listenForLogs()

	case spinner.TickMsg: // Handle spinner
		var cmd tea.Cmd
		if m.isLoading {
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
		return m, nil

	case tea.KeyMsg: // Handle quit keys during uninstall
		switch msg.String() {
		case "q":
			return m, tea.Quit
		}
	}
	return m, m.listenForLogs()
}
