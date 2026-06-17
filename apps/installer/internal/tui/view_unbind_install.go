package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/installer"
)

// viewInstallingUnbind shows the Unbind installation screen with progress tracking
func viewInstallingUnbind(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Show current action
	s.WriteString(m.spinner.View())
	s.WriteString(" ")
	s.WriteString(m.styles.Bold.Render("Installing Unbind and Dependencies..."))
	s.WriteString("\n\n")

	// OS info if available
	if m.osInfo != nil {
		s.WriteString(m.styles.Bold.Render("OS: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.PrettyName))
		s.WriteString("\n\n")
	}

	// Unbind Progress bar and status
	s.WriteString(m.styles.Bold.Render("Unbind Installation:"))
	s.WriteString("\n")

	// Status indicator
	switch m.unbindProgress.Status {
	case installer.StatusPending:
		s.WriteString("  [ ] ")
	case installer.StatusInstalling:
		s.WriteString("  [*] ")
	case installer.StatusCompleted:
		s.WriteString("  [✓] ")
	case installer.StatusFailed:
		s.WriteString("  [✗] ")
	}

	// Unbind label
	s.WriteString(m.styles.Bold.Render("Unbind"))
	s.WriteString(": ")

	// Current step description
	if m.unbindProgress.Description != "" {
		// Wrap the description text if it's too long
		descLines := wrapText(m.unbindProgress.Description, maxWidth-6) // Account for indentation
		for i, line := range descLines {
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

	// Progress bar for installing Unbind
	if m.unbindProgress.Status == installer.StatusInstalling {
		prog := m.styles.NewThemedProgress(progressBarWidth)
		prog.Width = progressBarWidth
		s.WriteString(prog.ViewAs(m.unbindProgress.Progress))
	} else if m.unbindProgress.Status == installer.StatusCompleted {
		// Show completion progress and time
		prog := m.styles.NewThemedProgress(progressBarWidth)
		prog.Width = progressBarWidth
		s.WriteString(prog.ViewAs(1.0))

		if !m.unbindProgress.StartTime.IsZero() && !m.unbindProgress.EndTime.IsZero() {
			duration := m.unbindProgress.EndTime.Sub(m.unbindProgress.StartTime).Round(time.Millisecond)
			timeText := fmt.Sprintf(" (completed in %s)", duration)
			s.WriteString(timeText)
		}
	} else if m.unbindProgress.Status == installer.StatusFailed {
		// Show error message
		prog := m.styles.NewThemedProgress(progressBarWidth)
		prog.Width = progressBarWidth
		s.WriteString(prog.ViewAs(m.unbindProgress.Progress))
		s.WriteString(" Failed")

		if m.unbindProgress.Error != nil {
			s.WriteString("\n      ")
			errorLines := wrapText(m.unbindProgress.Error.Error(), maxWidth-6)
			for _, line := range errorLines {
				s.WriteString(m.styles.Error.Render(line))
				s.WriteString("\n")
			}
		}
	} else {
		// Show pending progress bar (0%)
		prog := m.styles.NewThemedProgress(progressBarWidth)
		prog.Width = progressBarWidth
		s.WriteString(prog.ViewAs(0.0))
	}

	s.WriteString("\n\n")

	// Always display installation steps section even if empty
	s.WriteString(m.styles.Bold.Render("Installation steps:"))
	s.WriteString("\n")

	if len(m.unbindProgress.StepHistory) > 0 {
		// Show only the last 5 steps to keep the display manageable
		startIdx := 0
		if len(m.unbindProgress.StepHistory) > 5 {
			startIdx = len(m.unbindProgress.StepHistory) - 5
		}

		for i, step := range m.unbindProgress.StepHistory[startIdx:] {
			stepNum := fmt.Sprintf("  %d. ", startIdx+i+1)
			stepLines := wrapText(step, maxWidth-len(stepNum))
			for j, line := range stepLines {
				if j == 0 {
					s.WriteString(stepNum)
					s.WriteString(m.styles.Subtle.Render(line))
				} else {
					s.WriteString(strings.Repeat(" ", len(stepNum)))
					s.WriteString(m.styles.Subtle.Render(line))
				}
				s.WriteString("\n")
			}
		}
	} else {
		// Show a placeholder if no steps are available yet
		waitingText := "Waiting for installation steps..."
		for _, line := range wrapText(waitingText, maxWidth-2) {
			s.WriteString("  ")
			s.WriteString(line)
			s.WriteString("\n")
		}
	}
	s.WriteString("\n")

	// Educational facts section
	if m.currentFact != "" {
		s.WriteString(m.styles.Bold.Render("Did you know?"))
		s.WriteString("\n")
		factLines := wrapText(m.currentFact, maxWidth-2)
		for _, line := range factLines {
			s.WriteString("  ")
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
		s.WriteString("\n")
	}

	return renderWithLayout(m, s.String())
}

// updateInstallingUnbindState handles updates in the Unbind installation state
func (m Model) updateInstallingUnbindState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m.processStateUpdate(cmd)

	case installer.UnbindInstallUpdateMsg:
		// Update the Unbind progress in the model
		m.unbindProgress = msg

		// Log only significant progress updates to reduce logging overhead
		if msg.Progress == 0 || msg.Progress >= 0.25 && msg.Progress < 0.26 ||
			msg.Progress >= 0.5 && msg.Progress < 0.51 || msg.Progress >= 0.75 && msg.Progress < 0.76 ||
			msg.Progress == 1.0 || msg.Status == installer.StatusCompleted || msg.Status == installer.StatusFailed {
			m.logMessages = append(m.logMessages,
				"Unbind installation progress: "+fmt.Sprintf("%.1f%%", msg.Progress*100)+
					" - Status: "+string(msg.Status)+
					" - Step: "+msg.Description)
		}

		// If installation completed successfully or failed, send the appropriate message
		if msg.Status == installer.StatusCompleted {
			return m.processStateUpdate(func() tea.Msg {
				return unbindInstallCompleteMsg{}
			})
		} else if msg.Status == installer.StatusFailed {
			return m.processStateUpdate(func() tea.Msg {
				return errMsg{err: msg.Error}
			})
		}

		return m.processStateUpdate(nil)

	case unbindInstallCompleteMsg:
		// Install management script with cluster IP
		if err := installer.InstallManagementScript(m.dnsInfo.InternalIP); err != nil {
			m.logMessages = append(m.logMessages, fmt.Sprintf("Warning: Failed to install management script: %v", err))
		}

		// Move to installation complete state
		m.state = StateInstallationComplete
		m.isLoading = false

		return m, m.listenForLogs()

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
		// Handle nil messages from optimized progress listener
		return m.processStateUpdate(nil)
	}

	return m.processStateUpdate(nil)
}
