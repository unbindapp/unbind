package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/pkgmanager"
)

func progressFromPackages(p packageInstallProgressMsg) progressView {
	status := progressPending
	switch {
	case p.isComplete:
		status = progressCompleted
	case p.step != "":
		status = progressInstalling
	}
	return progressView{
		status:      status,
		description: p.step,
		progress:    p.progress,
		startTime:   p.startTime,
		endTime:     p.endTime,
	}
}

func viewInstallingPackages(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.spinner.View())
	s.WriteString(m.styles.Bold.Render("Installing required packages..."))
	s.WriteString("\n\n")
	s.WriteString(renderOSLine(m))
	s.WriteString(renderProgressSection(m, "Package Installation:", "Packages", progressFromPackages(m.packageProgress)))

	s.WriteString(m.styles.Bold.Render("Installing:"))
	s.WriteString("\n")
	bullet := m.styles.Key.Render("•")
	for _, pkg := range pkgmanager.GetDistributionPackages(m.osInfo.Distribution) {
		s.WriteString("  ")
		writeListItem(&s, m, bullet, pkg, maxWidth-2)
	}
	s.WriteString("\n")

	s.WriteString(renderRecentLogs(m, "Installation logs:", 5))
	return renderPage(m, s.String())
}

func (m Model) updateInstallingPackagesState(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case packageInstallProgressMsg:
		m.packageProgress = msg
		if msg.isComplete {
			return m, nil
		}
		return m, m.listenForPackageProgress()

	case installCompleteMsg:
		m.state = StateInstallComplete
		m.isLoading = false
		return m, autoAdvanceAfter(time.Second)
	}
	return m, nil
}

func viewInstallComplete(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Bold.Render("Installed Packages:"))
	s.WriteString("\n")
	check := m.styles.Success.Render("✓")
	for _, pkg := range pkgmanager.GetDistributionPackages(m.osInfo.Distribution) {
		s.WriteString("  ")
		writeListItem(&s, m, check, pkg, maxWidth-2)
	}
	s.WriteString("\n")
	s.WriteString(m.styles.Success.Render("✓ Finished installing pre-requisites!"))
	s.WriteString("\n\n")
	return renderPage(m, s.String())
}

func (m Model) updateInstallCompleteState(msg tea.Msg) (Model, tea.Cmd) {
	if _, ok := msg.(autoAdvanceMsg); !ok {
		return m, nil
	}
	return m.transition(StateInstallingK3S, true, m.installK3S(), m.listenForK3SProgress())
}

func viewInstallationComplete(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)

	s.WriteString(m.styles.Success.Render("✓ Unbind Installation Complete!"))
	s.WriteString("\n\n")
	writeWrapped(&s, m.styles.Normal, "Unbind is ready. Visit the link below to start using it:", maxWidth)
	writeWrapped(&s, m.styles.Success, fmt.Sprintf("https://%s", m.dnsInfo.UnbindDomain), maxWidth)
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("Management Options:"))
	s.WriteString("\n")
	writeWrapped(&s, m.styles.Normal, "A management script has been installed at /usr/local/bin/unbind", maxWidth)
	s.WriteString("\n")
	s.WriteString(m.styles.Normal.Render("Available commands:"))
	s.WriteString("\n")
	commands := []string{
		"unbind uninstall - Uninstall Unbind (WARNING: This will permanently delete all data)",
		"unbind add-node - Show instructions for adding a new node",
	}
	bullet := m.styles.Normal.Render("•")
	for _, cmd := range commands {
		s.WriteString("  ")
		writeListItem(&s, m, bullet, cmd, maxWidth-2)
	}
	s.WriteString("\n")

	s.WriteString(m.styles.Subtle.Render("Press Ctrl+c to exit."))
	return renderPage(m, s.String())
}
