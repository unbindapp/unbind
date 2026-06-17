package tui

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
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

// viewConfirmCreateSwap asks the user if they want to create swap.
func viewConfirmCreateSwap(m Model) string {
	s := strings.Builder{}
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	// Show spinner only if still loading disk space
	if m.isLoading {
		s.WriteString(m.spinner.View())
		s.WriteString(" ")
		s.WriteString(m.styles.Bold.Render("Checking disk space..."))
		s.WriteString("\n\n")
		s.WriteString(m.styles.Subtle.Render("Press 'Ctrl+c' to quit"))
		return renderWithLayout(m, s.String())
	}

	s.WriteString(m.styles.Bold.Render("Swap Configuration"))
	s.WriteString("\n\n")

	statusText := "No active swap space detected."
	for _, line := range wrapText(statusText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	descText := "Swap is virtual memory that uses disk space when RAM is full. While not recommended for container workloads (as it can impact performance and container isolation), it can help prevent out-of-memory crashes on resource-constrained systems."
	for _, line := range wrapText(descText, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	// Show available disk space if known
	if m.availableDiskSpaceGB >= 0 {
		diskText := fmt.Sprintf("Available Disk Space (Root FS): %.2f GB", m.availableDiskSpaceGB)
		s.WriteString(m.styles.Bold.Render(diskText))
		s.WriteString("\n\n")
	} else {
		errorText := "Could not determine available disk space."
		for _, line := range wrapText(errorText, maxWidth) {
			s.WriteString(m.styles.Error.Render(line))
			s.WriteString("\n")
		}
		s.WriteString("\n")
	}

	questionText := "Do you want to create a swap file now?"
	for _, line := range wrapText(questionText, maxWidth) {
		s.WriteString(m.styles.Bold.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	yesButton := m.styles.HighlightButton.Render(" Yes (y) ")
	noButton := m.styles.Subtle.Render(" No (n) ")

	// Center buttons if we have enough width
	buttonText := yesButton + "  " + noButton
	if maxWidth > len(" Yes (y)   No (n) ") {
		padding := (maxWidth - len(" Yes (y)   No (n) ")) / 2
		if padding > 0 {
			s.WriteString(strings.Repeat(" ", padding))
		}
	}
	s.WriteString(buttonText)
	s.WriteString("\n\n")

	instructionText := "Press 'y' to configure swap, 'n' to skip, or 'Ctrl+c' to quit."
	for _, line := range wrapText(instructionText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

	return renderWithLayout(m, s.String())
}

// viewEnterSwapSize prompts the user for the swap size.
func viewEnterSwapSize(m Model) string {
	s := strings.Builder{}
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Bold.Render("Configure Swap Size"))
	s.WriteString("\n\n")

	desc1Text := "Enter the desired size for the swap file in Gigabytes (GB)."
	for _, line := range wrapText(desc1Text, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}

	desc2Text := "The available disk space will be reduced by the swap size."
	for _, line := range wrapText(desc2Text, maxWidth) {
		s.WriteString(m.styles.Normal.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")

	if m.availableDiskSpaceGB > 0 {
		spaceText := fmt.Sprintf("Available disk space: %.2f GB", m.availableDiskSpaceGB)
		for _, line := range wrapText(spaceText, maxWidth) {
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
		s.WriteString("\n")
	}

	// Create styled input box
	inputWidth := maxWidth - 8 // Account for border and padding
	if inputWidth < 20 {
		inputWidth = 20
	}

	inputBox := createStyledBox(
		m.swapSizeInput.View(),
		lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#009900")).
			Padding(0, 1),
		inputWidth,
	)

	s.WriteString(inputBox)
	s.WriteString("\n\n")

	// Show validation error if any
	if m.swapSizeInputErr != nil {
		errorLines := wrapText(m.swapSizeInputErr.Error(), maxWidth)
		for _, line := range errorLines {
			s.WriteString(m.styles.Error.Render(line))
			s.WriteString("\n")
		}
		s.WriteString("\n")
	}

	instructionText := "Press Enter to confirm, or 'Ctrl+c' to quit."
	for _, line := range wrapText(instructionText, maxWidth) {
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}

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

	createText := fmt.Sprintf("Creating %s swap file...", m.swapSizeInput.Value()+"GB")
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

	successText := fmt.Sprintf("A %s GB swap file was created, activated, and configured to start on boot.", m.swapSizeInput.Value())
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
			m.state = StateInstallingPackages
			m.isLoading = true
			return m, tea.Batch(m.spinner.Tick, m.installRequiredPackages(), m.listenForLogs())
		} else {
			// No swap, transition to confirm create swap state
			m.state = StateConfirmCreateSwap
			m.isLoading = true
			return m, tea.Batch(m.spinner.Tick, m.getDiskSpaceCommand(), m.listenForLogs())
		}

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

func (m Model) updateConfirmCreateSwapState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case diskSpaceResultMsg:
		m.isLoading = false
		if msg.err != nil {
			m.logChan <- fmt.Sprintf("Warning: Could not get available disk space: %v", msg.err)
			m.availableDiskSpaceGB = -1
		} else {
			m.availableDiskSpaceGB = msg.availableGB
		}
		return m, m.listenForLogs()

	case tea.KeyMsg:
		// Special case for Yes action which needs additional setup
		if strings.ToLower(msg.String()) == "y" {
			m.state = StateEnterSwapSize
			m.isLoading = false
			m.swapSizeInput.Focus()
			m.swapSizeInput.SetValue("")
			m.swapSizeInputErr = nil
			return m, textinput.Blink
		} else if strings.ToLower(msg.String()) == "n" {
			// Skip to package installation
			return m.transition(StateInstallingPackages, true, m.installRequiredPackages())
		} else if msg.String() == "q" {
			return m, tea.Quit
		}

	case spinner.TickMsg:
		var cmd tea.Cmd
		if m.isLoading {
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
		return m, nil
	}
	return m, m.listenForLogs()
}

func (m Model) updateEnterSwapSizeState(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	// Always update the input field
	m.swapSizeInput, cmd = m.swapSizeInput.Update(msg)
	cmds = append(cmds, cmd)
	m.swapSizeInputErr = nil

	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		case "enter":
			// Validate the input
			valStr := m.swapSizeInput.Value()
			sizeGB, err := strconv.Atoi(valStr)

			// Input validation
			if err != nil {
				m.swapSizeInputErr = fmt.Errorf("invalid input: '%s' is not a number", valStr)
				return m, tea.Batch(cmds...)
			}
			if sizeGB <= 0 {
				m.swapSizeInputErr = fmt.Errorf("invalid size: %d GB. Must be greater than 0", sizeGB)
				return m, tea.Batch(cmds...)
			}
			// Check against available space (if known) - add a small buffer (e.g., 1GB)
			if m.availableDiskSpaceGB > 0 && float64(sizeGB) >= m.availableDiskSpaceGB-1 {
				m.swapSizeInputErr = fmt.Errorf("invalid size: %d GB exceeds available disk space (%.2f GB usable)", sizeGB, m.availableDiskSpaceGB-1)
				return m, tea.Batch(cmds...)
			}

			// Input is valid, transition to the next state
			return m.transition(StateCreatingSwap, true, m.createSwapCommand(sizeGB))

		case "q":
			return m, tea.Quit
		}
	}

	cmds = append(cmds, m.listenForLogs())
	return m, tea.Batch(cmds...)
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
