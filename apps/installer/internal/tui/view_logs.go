package tui

import (
	"fmt"
	"strings"
)

func viewDebugLogs(m Model) string {
	s := strings.Builder{}
	s.WriteString(m.styles.Title.Render("Debug Logs"))
	s.WriteString("\n\n")

	switch {
	case len(m.logMessages) == 0:
		s.WriteString("No logs available\n")
	default:
		s.WriteString(renderLogTail(m))
	}

	s.WriteString("\n")
	s.WriteString(m.styles.Subtle.Render("Press Ctrl+d to return, Ctrl+c to quit"))
	return renderWithLayout(m, s.String())
}

func renderLogTail(m Model) string {
	maxWidth := getUsableWidth(m.width)
	availableLines := getUsableHeight(m.height) - 4
	if availableLines < 5 {
		availableLines = 5
	}

	wrapped := make([][]string, len(m.logMessages))
	for i, msg := range m.logMessages {
		wrapped[i] = wrapText(fmt.Sprintf("%d: %s", i, msg), maxWidth)
	}

	start := len(wrapped)
	used := 0
	for start > 0 && used+len(wrapped[start-1]) <= availableLines {
		start--
		used += len(wrapped[start])
	}

	s := strings.Builder{}
	for _, lines := range wrapped[start:] {
		for _, line := range lines {
			s.WriteString(line)
			s.WriteString("\n")
		}
	}
	if start > 0 {
		s.WriteString(m.styles.Subtle.Render(fmt.Sprintf("... (%d older log entries hidden)", start)))
		s.WriteString("\n")
	}
	return s.String()
}
