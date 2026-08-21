package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func viewCheckingSwap(m Model) string {
	s := strings.Builder{}
	if m.isLoading {
		s.WriteString(m.spinner.View())
	}
	s.WriteString(m.styles.Bold.Render("Checking swap configuration..."))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func viewSwapPrompt(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Bold.Render("Swap is not enabled on this machine"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, fmt.Sprintf("Unbind can create and enable a %dGB swap file to reduce the risk of out-of-memory kills on smaller machines.", m.swapSizeGB), maxWidth)
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("Note about swap on Kubernetes:"))
	s.WriteString("\n")
	warnings := []string{
		"• Swap support (NodeSwap) is relatively new and can cause unpredictable performance.",
		"• Workloads may run slowly instead of being evicted, and memory limits/eviction behave differently.",
		"• Recommended only for memory-constrained single-node setups; skip it if you have ample RAM.",
	}
	for _, w := range warnings {
		writeWrapped(&s, m.styles.Subtle, w, maxWidth)
	}
	s.WriteString("\n")

	s.WriteString(renderKeyHints(m,
		keyHint{key: "y", desc: fmt.Sprintf("Create a %dGB swap file", m.swapSizeGB)},
		keyHint{key: "n", desc: "Continue without swap"},
	))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func viewCreatingSwap(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	if m.isLoading {
		s.WriteString(m.spinner.View())
	}
	s.WriteString(m.styles.Bold.Render(fmt.Sprintf("Creating %dGB swap file...", m.swapSizeGB)))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Subtle, "This might take a few moments, especially if using the 'dd' fallback...", maxWidth)
	s.WriteString("\n")
	writeWrapped(&s, m.styles.Subtle, "Press Ctrl+c to attempt to quit (may leave partial files).", maxWidth)
	return renderPage(m, s.String())
}

func viewSwapCreated(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Success.Render("✓ Swap File Created Successfully!"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, fmt.Sprintf("A %d GB swap file was created, activated, and configured to start on boot.", m.swapSizeGB), maxWidth)
	s.WriteString("\n")
	writeWrapped(&s, m.styles.Subtle, "Continuing installation automatically in a few seconds...", maxWidth)
	s.WriteString("\n")
	writeWrapped(&s, m.styles.Subtle, "Press Enter to continue immediately, or Ctrl+c to quit.", maxWidth)
	return renderPage(m, s.String())
}

func (m Model) startPackageInstall() (Model, tea.Cmd) {
	return m.transition(StateInstallingPackages, true, m.installRequiredPackages(), m.listenForPackageProgress())
}

func (m Model) updateCheckingSwapState(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case swapCheckResultMsg:
		if msg.err != nil {
			return m.fail(fmt.Errorf("failed to check swap status: %w", msg.err))
		}
		if msg.isEnabled {
			return m.startPackageInstall()
		}
		m.isLoading = true
		return m, m.decideSwapCommand()

	case swapDecisionMsg:
		if msg.err != nil {
			m.log(fmt.Sprintf("Could not determine swap recommendation (%v); skipping swap", msg.err))
			return m.startPackageInstall()
		}
		if msg.sizeGB <= 0 {
			m.log("Sufficient memory and/or limited disk; skipping swap creation")
			return m.startPackageInstall()
		}
		m.swapSizeGB = msg.sizeGB
		return m.transition(StateSwapPrompt, false)
	}
	return m, nil
}

func (m Model) updateSwapPromptState(msg tea.Msg) (Model, tea.Cmd) {
	keyMsg, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}

	switch strings.ToLower(keyMsg.String()) {
	case "y":
		m.log(fmt.Sprintf("Creating %dGB swap file", m.swapSizeGB))
		return m.transition(StateCreatingSwap, true, m.createSwapCommand(m.swapSizeGB))
	case "n", "enter":
		m.log("Continuing without swap")
		return m.startPackageInstall()
	}
	return m, nil
}

func (m Model) updateCreatingSwapState(msg tea.Msg) (Model, tea.Cmd) {
	result, ok := msg.(swapCreateResultMsg)
	if !ok {
		return m, nil
	}
	if result.err != nil {
		return m.fail(fmt.Errorf("failed to create swap file: %w", result.err))
	}
	m.state = StateSwapCreated
	m.isLoading = false
	return m, autoAdvanceAfter(3 * time.Second)
}

func (m Model) updateSwapCreatedState(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "enter" {
			return m.startPackageInstall()
		}
	case autoAdvanceMsg:
		return m.startPackageInstall()
	}
	return m, nil
}
