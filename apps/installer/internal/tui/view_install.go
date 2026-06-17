package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/pkgmanager"
)

// viewInstallingPackages shows the packages installation screen
func viewInstallingPackages(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Show current action
	s.WriteString(m.spinner.View())
	s.WriteString(" ")
	s.WriteString(m.styles.Bold.Render("Installing required packages..."))
	s.WriteString("\n\n")

	// OS info if available
	if m.osInfo != nil {
		s.WriteString(m.styles.Bold.Render("OS: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.PrettyName))
		s.WriteString("\n\n")
	}

	// Package Installation Progress bar and status
	s.WriteString(m.styles.Bold.Render("Package Installation:"))
	s.WriteString("\n")

	// Status indicator
	if m.packageProgress.isComplete {
		s.WriteString("  [✓] ")
	} else if m.packageProgress.step != "" {
		s.WriteString("  [*] ")
	} else {
		s.WriteString("  [ ] ")
	}

	// Label
	s.WriteString(m.styles.Bold.Render("Packages"))
	s.WriteString(": ")

	// Current step description
	if m.packageProgress.step != "" {
		// Wrap the step description if it's too long
		stepLines := wrapText(m.packageProgress.step, maxWidth-6) // Account for indentation
		for i, line := range stepLines {
			if i == 0 {
				s.WriteString(m.styles.Subtle.Render(line))
				s.WriteString("\n      ")
			} else {
				s.WriteString("      ")
				s.WriteString(m.styles.Subtle.Render(line))
				s.WriteString("\n      ")
			}
		}
	} else {
		s.WriteString("\n      ")
	}

	// Progress bar width calculation - use most of the available width with padding
	progressBarWidth := maxWidth - 6 // Leave some padding on both sides
	if progressBarWidth < 40 {
		progressBarWidth = 40 // Ensure reasonable minimum
	}

	// Progress bar for installation
	prog := m.styles.NewThemedProgress(progressBarWidth)
	// Ensure the width is properly set
	prog.Width = progressBarWidth
	s.WriteString(prog.ViewAs(m.packageProgress.progress))

	// Show completion status if complete
	if m.packageProgress.isComplete {
		if !m.packageProgress.startTime.IsZero() && !m.packageProgress.endTime.IsZero() {
			duration := m.packageProgress.endTime.Sub(m.packageProgress.startTime).Round(time.Millisecond)
			timeText := fmt.Sprintf(" (completed in %s)", duration)
			s.WriteString(timeText)
		} else {
			s.WriteString(" ✓")
		}
	}

	s.WriteString("\n\n")

	// Packages being installed
	s.WriteString(m.styles.Bold.Render("Installing:"))
	s.WriteString("\n")

	for _, pkg := range pkgmanager.GetDistributionPackages(m.osInfo.Distribution) {
		bullet := m.styles.Key.Render("•")
		pkgLine := fmt.Sprintf("%s %s", bullet, pkg)
		pkgLines := wrapText(pkgLine, maxWidth-2)
		for j, line := range pkgLines {
			if j == 0 {
				s.WriteString("  ")
				s.WriteString(m.styles.Normal.Render(line))
			} else {
				s.WriteString("    ") // Extra indent for continuation
				s.WriteString(m.styles.Normal.Render(line))
			}
			s.WriteString("\n")
		}
	}
	s.WriteString("\n")

	// Installation logs if any
	if len(m.logMessages) > 0 {
		s.WriteString(m.styles.Bold.Render("Installation logs:"))
		s.WriteString("\n")

		// Show last 5 log messages (or fewer if there aren't that many)
		startIdx := 0
		if len(m.logMessages) > 5 {
			startIdx = len(m.logMessages) - 5
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

	return renderWithLayout(m, s.String())
}

func (m Model) updateInstallingPackagesState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m.processStateUpdate(cmd)

	case packageInstallProgressMsg:
		// Update package progress in the model
		m.packageProgress = msg

		// Log significant progress updates
		if msg.progress == 0 || msg.progress >= 0.25 && msg.progress < 0.26 ||
			msg.progress >= 0.5 && msg.progress < 0.51 || msg.progress >= 0.75 && msg.progress < 0.76 ||
			msg.progress == 1.0 || msg.isComplete {
			m.logMessages = append(m.logMessages,
				"Package installation progress: "+fmt.Sprintf("%.1f%%", msg.progress*100)+
					" - Step: "+msg.step)
		}

		// If installation is complete, let the process continue
		if msg.isComplete {
			// Add a small delay to show the completed state before advancing
			return m.processStateUpdate(tea.Tick(500*time.Millisecond, func(time.Time) tea.Msg {
				return installCompleteMsg{}
			}))
		}

		return m.processStateUpdate(nil)

	case installCompleteMsg:
		m.state = StateInstallComplete
		m.isLoading = false

		// Schedule automatic advancement after waiting to ensure UI has time to settle
		return m.processStateUpdate(tea.Tick(1*time.Second, func(time.Time) tea.Msg {
			return autoAdvanceMsg{}
		}))

	case errMsg:
		m.err = msg.err
		m.state = StateError
		m.isLoading = false
		return m, m.listenForLogs()

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m.processStateUpdate(nil)

	case nil:
		// Handle nil messages (from the optimized progress listener)
		return m.processStateUpdate(nil)
	}

	return m.processStateUpdate(nil)
}

// viewInstallComplete shows the installation complete screen
func viewInstallComplete(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Installation summary
	s.WriteString(m.styles.Bold.Render("Installed Packages:"))
	s.WriteString("\n")

	for _, pkg := range pkgmanager.GetDistributionPackages(m.osInfo.Distribution) {
		checkmark := m.styles.Success.Render("✓")
		pkgLine := fmt.Sprintf("%s %s", checkmark, pkg)
		pkgLines := wrapText(pkgLine, maxWidth-2)
		for j, line := range pkgLines {
			if j == 0 {
				s.WriteString("  ")
				s.WriteString(m.styles.Normal.Render(line))
			} else {
				s.WriteString("    ") // Extra indent for continuation
				s.WriteString(m.styles.Normal.Render(line))
			}
			s.WriteString("\n")
		}
	}

	s.WriteString("\n")
	s.WriteString(m.styles.Success.Render("✓ Finished installing pre-requisites!"))
	s.WriteString("\n\n")

	return renderWithLayout(m, s.String())
}

// updateInstallCompleteState handles updates in the installation complete state
func (m Model) updateInstallCompleteState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case autoAdvanceMsg:
		// Start IP detection for DNS configuration
		m.state = StateDetectingIPs
		m.isLoading = true
		return m.processStateUpdate(
			m.spinner.Tick,
			m.startDetectingIPs(),
		)

	case errMsg:
		m.err = msg.err
		m.state = StateError
		m.isLoading = false
		return m, m.listenForLogs()

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, m.listenForLogs()
	}

	return m, m.listenForLogs()
}

// viewInstallationComplete shows the final installation complete screen
func viewInstallationComplete(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Success message
	s.WriteString(m.styles.Success.Render("✓ Unbind Installation Complete!"))
	s.WriteString("\n\n")

	// Domain information
	if m.dnsInfo != nil {
		s.WriteString(m.styles.Bold.Render("Visit your Unbind instance to complete setup:"))
		s.WriteString("\n")
		domainURL := fmt.Sprintf("https://%s", m.dnsInfo.UnbindDomain)
		for _, line := range wrapText(domainURL, maxWidth) {
			s.WriteString(m.styles.Normal.Render(line))
			s.WriteString("\n")
		}
		s.WriteString("\n")
	}

	// Management options
	s.WriteString(m.styles.Bold.Render("Management Options:"))
	s.WriteString("\n")

	mgmtText := "A management script has been installed at /usr/local/bin/unbind"
	for _, line := range wrapText(mgmtText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	s.WriteString(m.styles.Normal.Render("Available commands:"))
	s.WriteString("\n")

	commands := []string{
		"• unbind uninstall - Uninstall Unbind (WARNING: This will permanently delete all data)",
		"• unbind add-node - Show instructions for adding a new node",
	}

	for _, cmd := range commands {
		cmdLines := wrapText(cmd, maxWidth-2) // Account for indentation
		for j, line := range cmdLines {
			if j == 0 {
				s.WriteString("  ")
				s.WriteString(m.styles.Normal.Render(line))
			} else {
				s.WriteString("    ") // Extra indent for continuation
				s.WriteString(m.styles.Normal.Render(line))
			}
			s.WriteString("\n")
		}
	}
	s.WriteString("\n")

	// Additional information
	readyText := "Your Unbind instance is now ready to use."
	for _, line := range wrapText(readyText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	exitText := "Press 'Ctrl+c' to exit."
	for _, line := range wrapText(exitText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	return renderWithLayout(m, s.String())
}

// updateInstallationCompleteState handles updates in the installation complete state
func (m Model) updateInstallationCompleteState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}
	return m, m.listenForLogs()
}
