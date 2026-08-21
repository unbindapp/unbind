package tui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/installer"
	"github.com/unbindapp/unbind-installer/internal/k3s"
	"github.com/unbindapp/unbind-installer/internal/network"
	"github.com/unbindapp/unbind-installer/internal/osinfo"
)

type errMsg struct {
	err error
}

type logMsg struct {
	message string
}

type factMsg struct {
	fact string
}

type autoAdvanceMsg struct{}

type osInfoMsg struct {
	info *osinfo.OSInfo
}

type swapCheckResultMsg struct {
	isEnabled bool
	err       error
}

type swapDecisionMsg struct {
	sizeGB int
	err    error
}

type swapCreateResultMsg struct {
	err error
}

type installCompleteMsg struct{}

type packageInstallProgressMsg struct {
	packageName string
	progress    float64
	step        string
	isComplete  bool
	startTime   time.Time
	endTime     time.Time
}

type detectIPsCompleteMsg struct {
	ipInfo *network.IPInfo
}

type dnsValidationResultMsg struct {
	gen                int
	mainResolved       bool
	mainIPs            []string
	mainCloudflare     bool
	wildcardResolved   bool
	wildcardCloudflare bool
	wildcardProxied    bool
	registryChecked    bool
	credentialsValid   bool
	credentialsErr     string
	duration           time.Duration
}

type revalidateTickMsg struct {
	gen int
}

const revalidateInterval = 10 * time.Second

func revalidateTick(gen int) tea.Cmd {
	return tea.Tick(time.Second, func(time.Time) tea.Msg {
		return revalidateTickMsg{gen: gen}
	})
}

type k3sCheckResultMsg struct {
	checkResult *k3s.CheckResult
	err         error
}

type k3sUninstallCompleteMsg struct {
	err error
}

type k3sInstallCompleteMsg struct {
	unbindInstaller *installer.UnbindInstaller
}

type unbindInstallCompleteMsg struct{}
