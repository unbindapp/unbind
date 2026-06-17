package tui

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/unbindapp/unbind-installer/internal/errdefs"
	"github.com/unbindapp/unbind-installer/internal/osinfo"
)

// Layout utility functions to prevent overflow

// wrapText wraps text to fit within the given width
func wrapText(text string, width int) []string {
	if width <= 0 {
		return []string{text}
	}

	words := strings.Fields(text)
	if len(words) == 0 {
		return []string{""}
	}

	var lines []string
	var currentLine strings.Builder

	for _, word := range words {
		// If adding this word would exceed the width, start a new line
		if currentLine.Len() > 0 && currentLine.Len()+1+len(word) > width {
			lines = append(lines, currentLine.String())
			currentLine.Reset()
		}

		if currentLine.Len() > 0 {
			currentLine.WriteString(" ")
		}
		currentLine.WriteString(word)
	}

	if currentLine.Len() > 0 {
		lines = append(lines, currentLine.String())
	}

	return lines
}

// truncateText truncates text if it's longer than maxWidth and adds ellipsis
func truncateText(text string, maxWidth int) string {
	if maxWidth <= 0 {
		return text
	}

	if len(text) <= maxWidth {
		return text
	}

	if maxWidth <= 3 {
		return text[:maxWidth]
	}

	return text[:maxWidth-3] + "..."
}

// ensureMaxWidth ensures content doesn't exceed the specified width
func ensureMaxWidth(content string, maxWidth int) string {
	if maxWidth <= 0 {
		return content
	}

	lines := strings.Split(content, "\n")
	var processedLines []string

	for _, line := range lines {
		// Check if this line contains ANSI escape sequences (styled text)
		if strings.Contains(line, "\x1b[") {
			// For styled text like progress bars, don't truncate at all
			// Progress bars and styled content should be left as-is since we calculate their width carefully
			processedLines = append(processedLines, line)
		} else {
			// For plain text, truncate if necessary
			processedLines = append(processedLines, truncateText(line, maxWidth))
		}
	}

	return strings.Join(processedLines, "\n")
}

// getUsableWidth returns the usable width for content, accounting for borders and padding
func getUsableWidth(totalWidth int) int {
	// Account for minimal margins - be much less conservative
	usableWidth := totalWidth - 2 // Just 1 char margin on each side
	if usableWidth < 40 {
		usableWidth = 40 // Minimum usable width
	}
	if totalWidth > 0 && usableWidth > totalWidth {
		usableWidth = totalWidth
	}
	return usableWidth
}

// getUsableHeight returns the usable height for content
func getUsableHeight(totalHeight int) int {
	// Account for banner, status bar, and margins
	usableHeight := totalHeight - 12 // Account for banner (~6 lines) + margins
	if usableHeight < 10 {
		usableHeight = 10 // Minimum usable height
	}
	if totalHeight > 0 && usableHeight > totalHeight {
		usableHeight = totalHeight
	}
	return usableHeight
}

// renderWithLayout renders content with proper layout constraints
func renderWithLayout(m Model, content string) string {
	if m.width <= 0 {
		return content // No width constraints available
	}

	maxWidth := getUsableWidth(m.width)
	return ensureMaxWidth(content, maxWidth)
}

// createStyledBox creates a styled box with content that fits within the width
func createStyledBox(content string, style lipgloss.Style, maxWidth int) string {
	if maxWidth <= 0 {
		return style.Render(content)
	}

	// Account for border and padding in the style
	contentWidth := maxWidth - 4 // 2 chars for border, 2 for padding
	if contentWidth < 10 {
		contentWidth = 10
	}

	wrappedLines := wrapText(content, contentWidth)
	wrappedContent := strings.Join(wrappedLines, "\n")

	return style.Width(maxWidth).Render(wrappedContent)
}

// viewLoading shows the loading screen
func viewLoading(m Model) string {
	s := strings.Builder{}
	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")
	s.WriteString(m.spinner.View())
	s.WriteString(" ")
	s.WriteString(m.styles.Normal.Render("Detecting OS information..."))
	s.WriteString("\n\n")
	s.WriteString(m.styles.Subtle.Render("Press 'Ctrl+c' to quit"))

	return renderWithLayout(m, s.String())
}

// updateLoadingState handles updates in the loading state
func (m Model) updateLoadingState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, tea.Batch(cmd, m.listenForLogs())

	case osInfoMsg:
		m.osInfo = msg.info
		m.state = StateOSInfo
		m.isLoading = false

		// Schedule automatic advancement after 1 second
		return m, tea.Batch(
			m.listenForLogs(),
			tea.Tick(1*time.Second, func(time.Time) tea.Msg {
				return installPackagesMsg{}
			}),
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

// viewError shows the error screen
func viewError(m Model) string {
	s := strings.Builder{}
	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	maxWidth := getUsableWidth(m.width)

	if errors.Is(m.err, errdefs.ErrNotLinux) {
		s.WriteString(m.styles.Error.Render("Sorry, only Linux is supported for now!"))
	} else if errors.Is(m.err, errdefs.ErrInvalidArchitecture) {
		s.WriteString(m.styles.Error.Render("Sorry, this installer only supports amd64 and arm64 architectures!"))
		s.WriteString("\n")
		limitationMsg := "(this is a limitation of k3s)"
		for _, line := range wrapText(limitationMsg, maxWidth) {
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
	} else if errors.Is(m.err, errdefs.ErrUnsupportedDistribution) {
		s.WriteString(m.styles.Error.Render("Sorry, this distribution is not supported!"))
		supportedDistros := strings.Join(osinfo.AllSupportedDistros, ", ")
		s.WriteString("\n")
		supportedMsg := fmt.Sprintf("Supported distributions: %s", supportedDistros)
		for _, line := range wrapText(supportedMsg, maxWidth) {
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
	} else if errors.Is(m.err, errdefs.ErrUnsupportedVersion) {
		s.WriteString(m.styles.Error.Render("Sorry, this version is not supported!"))
		if m.osInfo != nil {
			supportedVersions := osinfo.AllSupportedDistrosVersions[m.osInfo.Distribution]
			supportedVersionsStr := strings.Join(supportedVersions, ", ")
			s.WriteString("\n")
			versionMsg := fmt.Sprintf("Supported versions: %s", supportedVersionsStr)
			for _, line := range wrapText(versionMsg, maxWidth) {
				s.WriteString(m.styles.Subtle.Render(line))
				s.WriteString("\n")
			}
		}
	} else if errors.Is(m.err, errdefs.ErrDistributionDetectionFailed) {
		s.WriteString(m.styles.Error.Render("Sorry, I couldn't detect your Linux distribution!"))
	} else if errors.Is(m.err, errdefs.ErrNotRoot) {
		s.WriteString(m.styles.Error.Render("Sorry, this installer must be run with root privileges!"))
	} else if errors.Is(m.err, errdefs.ErrK3sInstallFailed) {
		s.WriteString(m.styles.Error.Render("Sorry, the K3s installation failed!"))
		s.WriteString("\n")
		logsMsg := "Please check the logs for more details by pressing 'Ctrl+D'."
		for _, line := range wrapText(logsMsg, maxWidth) {
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
	} else if errors.Is(m.err, errdefs.ErrNetworkDetectionFailed) {
		s.WriteString(m.styles.Error.Render("Sorry, I couldn't detect your network interfaces!"))
		s.WriteString("\n")
		logsMsg := "Please check the logs for more details by pressing 'Ctrl+D'."
		for _, line := range wrapText(logsMsg, maxWidth) {
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
	} else if errors.Is(m.err, errdefs.ErrUnbindInstallFailed) {
		s.WriteString(m.styles.Error.Render("Sorry, the installation of unbind failed!"))
		s.WriteString("\n")
		logsMsg := "Please check the logs for more details by pressing 'Ctrl+D'."
		for _, line := range wrapText(logsMsg, maxWidth) {
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
	} else if m.err != nil {
		errorMsg := fmt.Sprintf("An error occurred: %v", m.err)
		for _, line := range wrapText(errorMsg, maxWidth) {
			s.WriteString(m.styles.Error.Render(line))
			s.WriteString("\n")
		}
	} else {
		errorMsg := fmt.Sprintf("Unknown error: %v", m.err)
		for _, line := range wrapText(errorMsg, maxWidth) {
			s.WriteString(m.styles.Error.Render(line))
			s.WriteString("\n")
		}
	}

	s.WriteString("\n\n")
	s.WriteString(m.styles.Subtle.Render("Press 'Ctrl+c' to quit"))

	return renderWithLayout(m, s.String())
}

// updateErrorState handles updates in the error state
func (m Model) updateErrorState(msg tea.Msg) (tea.Model, tea.Cmd) {
	if msg, ok := msg.(tea.WindowSizeMsg); ok {
		m.width = msg.Width
		m.height = msg.Height
	}

	return m, m.listenForLogs()
}

// viewOSInfo shows the OS information
func viewOSInfo(m Model) string {
	s := strings.Builder{}

	// Banner
	s.WriteString(getResponsiveBanner(m))
	s.WriteString("\n\n")

	// OS Pretty Name (if available)
	if m.osInfo.PrettyName != "" {
		s.WriteString(m.styles.Bold.Render("OS: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.PrettyName))
		s.WriteString("\n\n")
	}

	// Distribution and Version
	if m.osInfo.Distribution != "" {
		s.WriteString(m.styles.Bold.Render("Distribution: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.Distribution))
		s.WriteString("\n")
	}

	if m.osInfo.Version != "" {
		s.WriteString(m.styles.Bold.Render("Version: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.Version))
		s.WriteString("\n")
	}

	// Architecture
	if m.osInfo.Architecture != "" {
		s.WriteString(m.styles.Bold.Render("Architecture: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.Architecture))
		s.WriteString("\n")
	}

	s.WriteString("\n")
	s.WriteString(m.styles.Success.Render("✓ Your system is compatible with Unbind!"))
	s.WriteString("\n\n")

	return renderWithLayout(m, s.String())
}

// updateOSInfoState handles updates in the OS info state
func (m Model) updateOSInfoState(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case installPackagesMsg:
		m.state = StateCheckingSwap
		m.isLoading = true
		return m, tea.Batch(
			m.spinner.Tick,
			m.checkSwapCommand(),
			m.listenForLogs(),
		)

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, m.listenForLogs()
	}

	return m, m.listenForLogs()
}
