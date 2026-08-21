package tui

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/unbindapp/unbind-installer/internal/errdefs"
	"github.com/unbindapp/unbind-installer/internal/osinfo"
)

func wrapText(text string, width int) []string {
	if width <= 0 {
		return []string{text}
	}

	words := strings.Fields(text)
	if len(words) == 0 {
		return []string{""}
	}

	var lines []string
	var current strings.Builder
	for _, word := range words {
		if current.Len() > 0 && lipgloss.Width(current.String())+1+lipgloss.Width(word) > width {
			lines = append(lines, current.String())
			current.Reset()
		}
		if current.Len() > 0 {
			current.WriteString(" ")
		}
		current.WriteString(word)
	}
	if current.Len() > 0 {
		lines = append(lines, current.String())
	}
	return lines
}

func truncateText(text string, maxWidth int) string {
	if maxWidth <= 0 || lipgloss.Width(text) <= maxWidth {
		return text
	}

	runes := []rune(text)
	if maxWidth <= 3 {
		return string(runes[:maxWidth])
	}
	for len(runes) > 0 && lipgloss.Width(string(runes))+3 > maxWidth {
		runes = runes[:len(runes)-1]
	}
	return string(runes) + "..."
}

func ensureMaxWidth(content string, maxWidth int) string {
	if maxWidth <= 0 {
		return content
	}

	lines := strings.Split(content, "\n")
	for i, line := range lines {
		if strings.Contains(line, "\x1b[") {
			continue
		}
		lines[i] = truncateText(line, maxWidth)
	}
	return strings.Join(lines, "\n")
}

func getUsableWidth(totalWidth int) int {
	usable := totalWidth - 2
	if usable < 40 {
		usable = 40
	}
	if totalWidth > 0 && usable > totalWidth {
		usable = totalWidth
	}
	return usable
}

func getUsableHeight(totalHeight int) int {
	usable := totalHeight - 12
	if usable < 10 {
		usable = 10
	}
	if totalHeight > 0 && usable > totalHeight {
		usable = totalHeight
	}
	return usable
}

func renderWithLayout(m Model, content string) string {
	if m.width <= 0 {
		return content
	}
	return ensureMaxWidth(content, getUsableWidth(m.width))
}

func renderPage(m Model, body string) string {
	return renderWithLayout(m, getResponsiveBanner(m)+"\n\n"+body)
}

func writeWrapped(s *strings.Builder, style lipgloss.Style, text string, width int) {
	writeIndented(s, style, "", text, width)
}

func writeIndented(s *strings.Builder, style lipgloss.Style, indent, text string, width int) {
	for _, line := range wrapText(text, width-len(indent)) {
		s.WriteString(indent)
		s.WriteString(style.Render(line))
		s.WriteString("\n")
	}
}

func centered(m Model, rendered string) string {
	return lipgloss.PlaceHorizontal(getUsableWidth(m.width), lipgloss.Center, rendered)
}

func continueButton(m Model) string {
	return centered(m, m.styles.HighlightButton.Render("Press Enter to continue"))
}

func quitHint(m Model) string {
	return m.styles.Subtle.Render("Press Ctrl+c to quit")
}

type keyHint struct {
	key  string
	desc string
}

func renderKeyHints(m Model, hints ...keyHint) string {
	rendered := make([]string, 0, len(hints))
	for _, h := range hints {
		rendered = append(rendered, m.styles.KeyHint.Render(h.key)+" "+m.styles.Normal.Render(h.desc))
	}
	joined := strings.Join(rendered, "   ")
	if lipgloss.Width(joined) <= getUsableWidth(m.width) {
		return joined
	}
	return strings.Join(rendered, "\n")
}

func renderInputBox(m Model, label string, input textinput.Model) string {
	width := getUsableWidth(m.width) - 4
	if width < 24 {
		width = 24
	}
	return m.styles.InputBox.Width(width).Render(label + ": " + input.View())
}

func renderRecentLogs(m Model, title string, n int) string {
	if len(m.logMessages) == 0 {
		return ""
	}

	start := len(m.logMessages) - n
	if start < 0 {
		start = 0
	}

	s := strings.Builder{}
	s.WriteString(m.styles.Bold.Render(title))
	s.WriteString("\n")
	maxWidth := getUsableWidth(m.width) - 1
	for _, msg := range m.logMessages[start:] {
		for _, line := range wrapText(msg, maxWidth) {
			s.WriteString(" ")
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
	}
	return s.String()
}

func renderOSLine(m Model) string {
	if m.osInfo == nil {
		return ""
	}
	return m.styles.Bold.Render("OS: ") + m.styles.Normal.Render(m.osInfo.PrettyName) + "\n\n"
}

func renderFact(m Model) string {
	if m.currentFact == "" {
		return ""
	}
	s := strings.Builder{}
	s.WriteString(m.styles.Bold.Render("Did you know?"))
	s.WriteString("\n")
	for _, line := range wrapText(m.currentFact, getUsableWidth(m.width)-2) {
		s.WriteString("  ")
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("\n")
	return s.String()
}

func renderStepHistory(m Model, steps []string, max int) string {
	s := strings.Builder{}
	s.WriteString(m.styles.Bold.Render("Installation steps:"))
	s.WriteString("\n")

	if len(steps) == 0 {
		s.WriteString("  Waiting for installation steps...\n\n")
		return s.String()
	}

	start := len(steps) - max
	if start < 0 {
		start = 0
	}
	maxWidth := getUsableWidth(m.width)
	for i, step := range steps[start:] {
		prefix := fmt.Sprintf("  %d. ", start+i+1)
		indent := strings.Repeat(" ", len(prefix))
		for j, line := range wrapText(step, maxWidth-len(prefix)) {
			if j == 0 {
				s.WriteString(prefix)
			} else {
				s.WriteString(indent)
			}
			s.WriteString(m.styles.Subtle.Render(line))
			s.WriteString("\n")
		}
	}
	s.WriteString("\n")
	return s.String()
}

type checkState int

const (
	checkPending checkState = iota
	checkOK
	checkWarn
	checkFail
)

func renderCheckLine(m Model, state checkState, text, detail string) string {
	var glyph string
	var style lipgloss.Style
	switch state {
	case checkOK:
		glyph, style = "✓", m.styles.Success
	case checkWarn:
		glyph, style = "!", m.styles.Warning
	case checkFail:
		glyph, style = "✗", m.styles.Error
	default:
		glyph, style = "○", m.styles.Pending
	}

	s := "  " + style.Render(glyph+" "+text) + "\n"
	if detail == "" {
		return s
	}
	for _, line := range wrapText(detail, getUsableWidth(m.width)-4) {
		s += "    " + m.styles.Subtle.Render(line) + "\n"
	}
	return s
}

type progressView struct {
	status      string
	description string
	progress    float64
	err         error
	startTime   time.Time
	endTime     time.Time
}

const (
	progressPending    = "pending"
	progressInstalling = "installing"
	progressCompleted  = "completed"
	progressFailed     = "failed"
)

func renderProgressSection(m Model, title, label string, p progressView) string {
	maxWidth := getUsableWidth(m.width)
	s := strings.Builder{}
	s.WriteString(m.styles.Bold.Render(title))
	s.WriteString("\n")

	switch p.status {
	case progressInstalling:
		s.WriteString("  [*] ")
	case progressCompleted:
		s.WriteString("  [✓] ")
	case progressFailed:
		s.WriteString("  [✗] ")
	default:
		s.WriteString("  [ ] ")
	}
	s.WriteString(m.styles.Bold.Render(label))
	s.WriteString(": ")

	for i, line := range wrapText(p.description, maxWidth-6) {
		if i > 0 {
			s.WriteString("      ")
		}
		s.WriteString(m.styles.Subtle.Render(line))
		s.WriteString("\n")
	}
	s.WriteString("      ")

	barWidth := maxWidth - 6
	if barWidth < 40 {
		barWidth = 40
	}
	bar := m.styles.NewThemedProgress(barWidth)

	switch p.status {
	case progressCompleted:
		s.WriteString(bar.ViewAs(1.0))
		if !p.startTime.IsZero() && !p.endTime.IsZero() {
			s.WriteString(fmt.Sprintf(" (completed in %s)", p.endTime.Sub(p.startTime).Round(time.Millisecond)))
		}
	case progressFailed:
		s.WriteString(bar.ViewAs(p.progress))
		s.WriteString(" Failed")
		if p.err != nil {
			s.WriteString("\n      ")
			writeWrapped(&s, m.styles.Error, p.err.Error(), maxWidth-6)
		}
	default:
		s.WriteString(bar.ViewAs(p.progress))
	}
	s.WriteString("\n\n")
	return s.String()
}

func viewLoading(m Model) string {
	s := strings.Builder{}
	s.WriteString(m.spinner.View())
	s.WriteString(m.styles.Normal.Render("Detecting OS information..."))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func (m Model) updateLoadingState(msg tea.Msg) (Model, tea.Cmd) {
	info, ok := msg.(osInfoMsg)
	if !ok {
		return m, nil
	}

	m.osInfo = info.info
	m.state = StateOSInfo
	m.isLoading = false
	return m, autoAdvanceAfter(time.Second)
}

func autoAdvanceAfter(d time.Duration) tea.Cmd {
	return tea.Tick(d, func(time.Time) tea.Msg {
		return autoAdvanceMsg{}
	})
}

func viewError(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)
	logsHint := "Please check the logs for more details by pressing Ctrl+d."

	switch {
	case errors.Is(m.err, errdefs.ErrNotLinux):
		s.WriteString(m.styles.Error.Render("Sorry, only Linux is supported for now!"))
	case errors.Is(m.err, errdefs.ErrInvalidArchitecture):
		s.WriteString(m.styles.Error.Render("Sorry, this installer only supports amd64 and arm64 architectures!"))
		s.WriteString("\n")
		writeWrapped(&s, m.styles.Subtle, "(this is a limitation of k3s)", maxWidth)
	case errors.Is(m.err, errdefs.ErrUnsupportedDistribution):
		s.WriteString(m.styles.Error.Render("Sorry, this distribution is not supported!"))
		s.WriteString("\n")
		writeWrapped(&s, m.styles.Subtle, "Supported distributions: "+strings.Join(osinfo.AllSupportedDistros, ", "), maxWidth)
	case errors.Is(m.err, errdefs.ErrUnsupportedVersion):
		s.WriteString(m.styles.Error.Render("Sorry, this version is not supported!"))
		if m.osInfo != nil {
			s.WriteString("\n")
			versions := strings.Join(osinfo.AllSupportedDistrosVersions[m.osInfo.Distribution], ", ")
			writeWrapped(&s, m.styles.Subtle, "Supported versions: "+versions, maxWidth)
		}
	case errors.Is(m.err, errdefs.ErrDistributionDetectionFailed):
		s.WriteString(m.styles.Error.Render("Sorry, I couldn't detect your Linux distribution!"))
	case errors.Is(m.err, errdefs.ErrNotRoot):
		s.WriteString(m.styles.Error.Render("Sorry, this installer must be run with root privileges!"))
	case errors.Is(m.err, errdefs.ErrK3sInstallFailed):
		s.WriteString(m.styles.Error.Render("Sorry, the K3s installation failed!"))
		s.WriteString("\n")
		writeWrapped(&s, m.styles.Subtle, logsHint, maxWidth)
	case errors.Is(m.err, errdefs.ErrNetworkDetectionFailed):
		s.WriteString(m.styles.Error.Render("Sorry, I couldn't detect your network interfaces!"))
		s.WriteString("\n")
		writeWrapped(&s, m.styles.Subtle, logsHint, maxWidth)
	case errors.Is(m.err, errdefs.ErrUnbindInstallFailed):
		s.WriteString(m.styles.Error.Render("Sorry, the installation of Unbind failed!"))
		s.WriteString("\n")
		writeWrapped(&s, m.styles.Subtle, logsHint, maxWidth)
	default:
		writeWrapped(&s, m.styles.Error, fmt.Sprintf("An error occurred: %v", m.err), maxWidth)
	}

	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func viewOSInfo(m Model) string {
	s := strings.Builder{}
	if m.osInfo.PrettyName != "" {
		s.WriteString(m.styles.Bold.Render("OS: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.PrettyName))
		s.WriteString("\n\n")
	}
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
	if m.osInfo.Architecture != "" {
		s.WriteString(m.styles.Bold.Render("Architecture: "))
		s.WriteString(m.styles.Normal.Render(m.osInfo.Architecture))
		s.WriteString("\n")
	}
	s.WriteString("\n")
	s.WriteString(m.styles.Success.Render("✓ Your system is compatible with Unbind!"))
	s.WriteString("\n\n")
	return renderPage(m, s.String())
}

func (m Model) updateOSInfoState(msg tea.Msg) (Model, tea.Cmd) {
	if _, ok := msg.(autoAdvanceMsg); !ok {
		return m, nil
	}
	return m.transition(StateDetectingIPs, true, m.startDetectingIPs())
}
