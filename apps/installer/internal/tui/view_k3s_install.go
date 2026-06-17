package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/k3s"
)

// viewInstallingK3S shows the K3S installation screen with progress tracking
func viewInstallingK3S(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Show current action
	s.WriteString(m.spinner.View())
	s.WriteString(" ")
	s.WriteString(m.styles.Bold.Render("Installing K3S..."))
	s.WriteString("\n\n")

	// OS info if available
	if m.osInfo != nil {
		s.WriteString(m.styles.Bold.Render("OS: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.PrettyName))
		s.WriteString("\n\n")
	}

	// K3S Progress bar and status
	s.WriteString(m.styles.Bold.Render("K3S Installation:"))
	s.WriteString("\n")

	// Status indicator
	switch m.k3sProgress.Status {
	case "pending":
		s.WriteString("  [ ] ")
	case "installing":
		s.WriteString("  [*] ")
	case "completed":
		s.WriteString("  [✓] ")
	case "failed":
		s.WriteString("  [✗] ")
	}

	// K3S label
	s.WriteString(m.styles.Bold.Render("K3S"))
	s.WriteString(": ")

	// Current step description
	if m.k3sProgress.Description != "" {
		// Wrap the description text if it's too long
		descLines := wrapText(m.k3sProgress.Description, maxWidth-6) // Account for indentation
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

	// Progress bar for installing K3S
	if m.k3sProgress.Status == "installing" {
		prog := m.styles.NewThemedProgress(progressBarWidth)
		prog.Width = progressBarWidth
		s.WriteString(prog.ViewAs(m.k3sProgress.Progress))
	} else if m.k3sProgress.Status == "completed" {
		// Show completion progress and time
		prog := m.styles.NewThemedProgress(progressBarWidth)
		prog.Width = progressBarWidth
		s.WriteString(prog.ViewAs(1.0))

		if !m.k3sProgress.StartTime.IsZero() && !m.k3sProgress.EndTime.IsZero() {
			duration := m.k3sProgress.EndTime.Sub(m.k3sProgress.StartTime).Round(time.Millisecond)
			timeText := fmt.Sprintf(" (completed in %s)", duration)
			s.WriteString(timeText)
		}
	} else if m.k3sProgress.Status == "failed" {
		// Show error message
		prog := m.styles.NewThemedProgress(progressBarWidth)
		prog.Width = progressBarWidth
		s.WriteString(prog.ViewAs(m.k3sProgress.Progress))
		s.WriteString(" Failed")

		if m.k3sProgress.Error != nil {
			s.WriteString("\n      ")
			errorLines := wrapText(m.k3sProgress.Error.Error(), maxWidth-6)
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

	if len(m.k3sProgress.StepHistory) > 0 {
		// Show only the last 5 steps to keep the display manageable
		startIdx := 0
		if len(m.k3sProgress.StepHistory) > 5 {
			startIdx = len(m.k3sProgress.StepHistory) - 5
		}

		for i, step := range m.k3sProgress.StepHistory[startIdx:] {
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

// updateInstallingK3SState handles updates in the K3S installation state
func (m Model) updateInstallingK3SState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m.processStateUpdate(cmd)

	case k3s.K3SUpdateMessage:
		// Update the K3S progress in the model
		m.k3sProgress = msg

		// Log only significant progress updates to reduce logging overhead
		if msg.Progress == 0 || msg.Progress >= 0.25 && msg.Progress < 0.26 ||
			msg.Progress >= 0.5 && msg.Progress < 0.51 || msg.Progress >= 0.75 && msg.Progress < 0.76 ||
			msg.Progress == 1.0 || msg.Status == "completed" || msg.Status == "failed" {
			m.logMessages = append(m.logMessages,
				"K3S installation progress: "+fmt.Sprintf("%.1f%%", msg.Progress*100)+
					" - Status: "+string(msg.Status)+
					" - Step: "+msg.Description)
		}

		// If installation completed successfully or failed, send the appropriate message
		if msg.Status == "completed" {
			return m.processStateUpdate(func() tea.Msg {
				return k3sInstallCompleteMsg{
					kubeClient:      m.kubeClient,
					kubeConfig:      "/etc/rancher/k3s/k3s.yaml",
					unbindInstaller: m.unbindInstaller,
				}
			})
		} else if msg.Status == "failed" {
			return m.processStateUpdate(func() tea.Msg {
				return errMsg{err: msg.Error}
			})
		}

		return m.processStateUpdate(nil)

	case k3sInstallCompleteMsg:
		// Install Unbind after K3S
		m.state = StateInstallingUnbind
		m.isLoading = true
		m.kubeClient = msg.kubeClient
		m.kubeConfig = msg.kubeConfig
		m.unbindInstaller = msg.unbindInstaller

		return m.processStateUpdate(
			m.spinner.Tick,
			m.installUnbind(),
		)

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
