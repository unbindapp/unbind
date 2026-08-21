package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/installer"
)

func progressFromUnbind(p installer.UnbindInstallUpdateMsg) progressView {
	return progressView{
		status:      string(p.Status),
		description: p.Description,
		progress:    p.Progress,
		err:         p.Error,
		startTime:   p.StartTime,
		endTime:     p.EndTime,
	}
}

func viewInstallingUnbind(m Model) string {
	s := strings.Builder{}
	s.WriteString(m.spinner.View())
	s.WriteString(m.styles.Bold.Render("Installing Unbind and Dependencies..."))
	s.WriteString("\n\n")
	s.WriteString(renderOSLine(m))
	s.WriteString(renderProgressSection(m, "Unbind Installation:", "Unbind", progressFromUnbind(m.unbindProgress)))
	s.WriteString(renderStepHistory(m, m.unbindProgress.StepHistory, 5))
	s.WriteString(renderFact(m))
	return renderPage(m, s.String())
}

func (m Model) updateInstallingUnbindState(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case installer.UnbindInstallUpdateMsg:
		m.unbindProgress = msg
		if msg.Status == installer.StatusCompleted || msg.Status == installer.StatusFailed {
			return m, nil
		}
		return m, m.listenForUnbindProgress()

	case unbindInstallCompleteMsg:
		if err := installer.InstallManagementScript(m.dnsInfo.InternalIP); err != nil {
			m.log(fmt.Sprintf("Warning: Failed to install management script: %v", err))
		}
		return m.transition(StateInstallationComplete, false)
	}
	return m, nil
}
