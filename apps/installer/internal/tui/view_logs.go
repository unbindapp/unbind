package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

// viewDebugLogs shows debug logs with proper text wrapping and overflow handling
func viewDebugLogs(m Model) string {
	s := strings.Builder{}
	s.WriteString(m.styles.Title.Render("Debug Logs"))
	s.WriteString("\n\n")

	if len(m.logMessages) == 0 {
		s.WriteString("No logs available")
	} else {
		maxWidth := getUsableWidth(m.width)
		maxHeight := getUsableHeight(m.height)

		// Calculate how many log lines we can show
		headerLines := 4 // Title + spacing + status bar
		availableLines := maxHeight - headerLines
		if availableLines < 5 {
			availableLines = 5
		}

		// Show the most recent logs that fit in the available space
		startIdx := 0
		totalLogLines := 0

		// Count total lines needed for all logs (including wrapped lines)
		for i := len(m.logMessages) - 1; i >= 0; i-- {
			logLine := fmt.Sprintf("%d: %s", i, m.logMessages[i])
			wrappedLines := wrapText(logLine, maxWidth)
			totalLogLines += len(wrappedLines)
		}

		// If we have more lines than available space, show only the most recent ones
		if totalLogLines > availableLines {
			currentLines := 0
			for i := len(m.logMessages) - 1; i >= 0; i-- {
				logLine := fmt.Sprintf("%d: %s", i, m.logMessages[i])
				wrappedLines := wrapText(logLine, maxWidth)
				if currentLines+len(wrappedLines) > availableLines {
					startIdx = i + 1
					break
				}
				currentLines += len(wrappedLines)
			}
		}

		// Render the logs that fit
		for i := startIdx; i < len(m.logMessages); i++ {
			logLine := fmt.Sprintf("%d: %s", i, m.logMessages[i])
			wrappedLines := wrapText(logLine, maxWidth)
			for _, line := range wrappedLines {
				s.WriteString(line)
				s.WriteString("\n")
			}
		}

		// Show truncation indicator if we're not showing all logs
		if startIdx > 0 {
			s.WriteString(m.styles.Subtle.Render(fmt.Sprintf("... (%d older log entries hidden)", startIdx)))
			s.WriteString("\n")
		}
	}

	s.WriteString("\n")
	s.WriteString(m.styles.StatusBar.Render("Press 'Ctrl+D' to return, 'Ctrl+c' to quit"))

	return renderWithLayout(m, s.String())
}

func (m Model) updateDebugLogsState(msg tea.Msg) (tea.Model, tea.Cmd) {
	if msg, ok := msg.(tea.WindowSizeMsg); ok {
		m.width = msg.Width
		m.height = msg.Height
	}

	return m, m.listenForLogs()
}
