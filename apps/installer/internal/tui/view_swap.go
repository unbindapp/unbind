package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
)

// viewCheckingSwap shows progress while checking swap status.
func viewCheckingSwap(m Model) string {
	s := strings.Builder{}
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	if m.isLoading {
		s.WriteString(m.spinner.View())
		s.WriteString(" ")
	}
	s.WriteString(m.styles.Bold.Render("Checking swap configuration..."))
	s.WriteString("\n\n")
	s.WriteString(m.styles.Subtle.Render("Press 'Ctrl+c' to quit"))
	return renderWithLayout(m, s.String())
}

// viewCreatingSwap shows progress while the swap file is being created.
func viewCreatingSwap(m Model) string {
	s := strings.Builder{}
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	if m.isLoading {
		s.WriteString(m.spinner.View())
		s.WriteString(" ")
	}

	createText := fmt.Sprintf("Creating %dGB swap file...", m.swapSizeGB)
	s.WriteString(m.styles.Bold.Render(createText))
	s.WriteString("\n\n")

	noteText1 := "This might take a few moments, especially if using the 'dd' fallback..."
	for _, line := range wrapText(noteText1, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	noteText2 := "Check console output for 'dd' progress if applicable."
	for _, line := range wrapText(noteText2, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	quitText := "Press 'Ctrl+c' to attempt to quit (may leave partial files)."
	for _, line := range wrapText(quitText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	return renderWithLayout(m, s.String())
}

// viewSwapCreated shows a success message after swap creation.
func viewSwapCreated(m Model) string {
	s := strings.Builder{}
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Success.Render("✓ Swap File Created Successfully!"))
	s.WriteString("\n\n")

	successText := fmt.Sprintf("A %d GB swap file was created, activated, and configured to start on boot.", m.swapSizeGB)
	for _, line := range wrapText(successText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	autoText := "Continuing installation automatically in a few seconds..."
	for _, line := range wrapText(autoText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	continueText := "Press Enter to continue immediately, or 'Ctrl+c' to quit."
	for _, line := range wrapText(continueText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	return renderWithLayout(m, s.String())
}

func (m Model) updateCheckingSwapState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case swapCheckResultMsg:
		m.isLoading = false
		if msg.err != nil {
			// Handle error with our error helper
			m.err = fmt.Errorf("Failed to check swap status: %w", msg.err)
			m.state = StateError
			m.logChan <- fmt.Sprintf("ERROR: %s", m.err.Error())
			return m, m.listenForLogs()
		}

		if msg.isEnabled {
			// Swap exists, skip creation flow and go to installing packages
			return m.transition(StateInstallingPackages, true, m.installRequiredPackages())
		}

		// No swap: decide a size automatically from RAM and disk
		m.isLoading = true
		return m, tea.Batch(m.spinner.Tick, m.decideSwapCommand(), m.listenForLogs())

	case swapDecisionMsg:
		if msg.err != nil {
			m.logChan <- fmt.Sprintf("Could not determine swap recommendation (%v); skipping swap", msg.err)
			return m.transition(StateInstallingPackages, true, m.installRequiredPackages())
		}
		if msg.sizeGB <= 0 {
			m.logChan <- "Sufficient memory and/or limited disk; skipping swap creation"
			return m.transition(StateInstallingPackages, true, m.installRequiredPackages())
		}
		m.swapSizeGB = msg.sizeGB
		return m.transition(StateCreatingSwap, true, m.createSwapCommand(msg.sizeGB))

	case errMsg:
		// Handle error with our error helper
		m.err = fmt.Errorf("Error checking swap: %w", msg.err)
		m.state = StateError
		m.logChan <- fmt.Sprintf("ERROR: %s", m.err.Error())
		return m, m.listenForLogs()

	case spinner.TickMsg:
		var cmd tea.Cmd
		if m.isLoading {
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "q":
			return m, tea.Quit
		}
	}
	return m, m.listenForLogs()
}

func (m Model) updateCreatingSwapState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case swapCreateResultMsg:
		m.isLoading = false
		if msg.err != nil {
			// Handle error directly
			m.err = fmt.Errorf("Failed to create swap file: %w", msg.err)
			m.state = StateError
			m.logChan <- fmt.Sprintf("ERROR: %s", m.err.Error())
			return m, m.listenForLogs()
		}
		// Swap created successfully
		m.state = StateSwapCreated
		m.isLoading = false
		return m, tea.Tick(3*time.Second, func(t time.Time) tea.Msg {
			return autoAdvanceMsg{}
		})

	case errMsg:
		// Handle error directly
		m.err = fmt.Errorf("Error creating swap: %w", msg.err)
		m.state = StateError
		m.logChan <- fmt.Sprintf("ERROR: %s", m.err.Error())
		return m, m.listenForLogs()

	case spinner.TickMsg:
		var cmd tea.Cmd
		if m.isLoading {
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "q":
			return m, tea.Quit
		}
	}
	return m, m.listenForLogs()
}

func (m Model) updateSwapCreatedState(msg tea.Msg) (tea.Model, tea.Cmd) {
	// This state just shows success and waits for Enter or auto-advances
	advance := func() (tea.Model, tea.Cmd) {
		// Set state directly
		m.state = StateInstallingPackages
		m.isLoading = true
		return m, tea.Batch(m.spinner.Tick, m.installRequiredPackages(), m.listenForLogs())
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "enter":
			return advance()
		case "q":
			return m, tea.Quit
		}
	case autoAdvanceMsg:
		return advance()
	}
	return m, m.listenForLogs()
}
