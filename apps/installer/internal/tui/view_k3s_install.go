package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/k3s"
)

func progressFromK3s(p k3s.K3SUpdateMessage) progressView {
	return progressView{
		status:      p.Status,
		description: p.Description,
		progress:    p.Progress,
		err:         p.Error,
		startTime:   p.StartTime,
		endTime:     p.EndTime,
	}
}

func viewInstallingK3S(m Model) string {
	s := strings.Builder{}
	s.WriteString(m.spinner.View())
	s.WriteString(m.styles.Bold.Render("Installing K3S..."))
	s.WriteString("\n\n")
	s.WriteString(renderOSLine(m))
	s.WriteString(renderProgressSection(m, "K3S Installation:", "K3S", progressFromK3s(m.k3sProgress)))
	s.WriteString(renderStepHistory(m, m.k3sProgress.StepHistory, 5))
	s.WriteString(renderFact(m))
	return renderPage(m, s.String())
}

func (m Model) updateInstallingK3SState(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case k3s.K3SUpdateMessage:
		m.k3sProgress = msg
		if msg.Status == progressCompleted || msg.Status == progressFailed {
			return m, nil
		}
		return m, m.listenForK3SProgress()

	case k3sInstallCompleteMsg:
		m.unbindInstaller = msg.unbindInstaller
		return m.transition(StateInstallingUnbind, true, m.installUnbind(), m.listenForUnbindProgress())
	}
	return m, nil
}
