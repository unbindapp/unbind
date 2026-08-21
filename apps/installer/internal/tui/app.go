package tui

import (
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/installer"
	"github.com/unbindapp/unbind-installer/internal/k3s"
	"github.com/unbindapp/unbind-installer/internal/osinfo"
)

type Model struct {
	version string

	state         ApplicationState
	showDebugLogs bool
	initCmd       tea.Cmd

	osInfo                 *osinfo.OSInfo
	err                    error
	k3sUninstallScriptPath string
	swapSizeGB             int

	spinner   spinner.Model
	width     int
	height    int
	isLoading bool
	styles    Styles

	logMessages []string
	logChan     chan string

	factChan    chan string
	currentFact string

	dnsInfo           dnsInfo
	validation        validationStatus
	domainInput       textinput.Model
	domainError       string
	usernameInput     textinput.Model
	passwordInput     textinput.Model
	registryHostInput textinput.Model
	selectedRegistry  int

	unbindInstaller *installer.UnbindInstaller

	k3sProgressChan chan k3s.K3SUpdateMessage
	k3sProgress     k3s.K3SUpdateMessage

	unbindProgressChan chan installer.UnbindInstallUpdateMsg
	unbindProgress     installer.UnbindInstallUpdateMsg

	packageProgressChan chan packageInstallProgressMsg
	packageProgress     packageInstallProgressMsg
}

func NewModel(version string) Model {
	styles := NewStyles(DefaultTheme())

	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = styles.SpinnerStyle

	return Model{
		version:             version,
		state:               StateWelcome,
		spinner:             s,
		styles:              styles,
		logChan:             make(chan string, 1000),
		factChan:            make(chan string, 10),
		unbindProgressChan:  make(chan installer.UnbindInstallUpdateMsg, 100),
		k3sProgressChan:     make(chan k3s.K3SUpdateMessage, 100),
		packageProgressChan: make(chan packageInstallProgressMsg, 100),
		k3sProgress: k3s.K3SUpdateMessage{
			Status:      progressPending,
			Description: "Initializing K3S installation",
		},
		unbindProgress: installer.UnbindInstallUpdateMsg{
			Name:        "unbind",
			Status:      installer.StatusPending,
			Description: "Initializing Unbind installation",
		},
		packageProgress: packageInstallProgressMsg{
			step: "Initializing package installation",
		},
		domainInput:       initializeDomainInput(styles),
		usernameInput:     initializeUsernameInput(styles),
		passwordInput:     initializePasswordInput(styles),
		registryHostInput: initializeRegistryHostInput(styles),
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.listenForLogs(), m.listenForFacts(), m.initCmd)
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit
		case "ctrl+d":
			if m.state != StateDNSConfig && m.state != StateExternalRegistryInput {
				m.showDebugLogs = !m.showDebugLogs
				return m, nil
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	case logMsg:
		m.logMessages = append(m.logMessages, msg.messages...)
		return m, m.listenForLogs()
	case factMsg:
		m.currentFact = msg.fact
		return m, m.listenForFacts()
	case errMsg:
		return m.fail(msg.err)
	}

	return m.updateState(msg)
}

func (m Model) updateState(msg tea.Msg) (Model, tea.Cmd) {
	switch m.state {
	case StateWelcome:
		return m.updateWelcomeState(msg)
	case StateCheckK3s:
		return m.updateCheckK3sState(msg)
	case StateConfirmUninstallK3s:
		return m.updateConfirmUninstallK3sState(msg)
	case StateUninstallingK3s:
		return m.updateUninstallingK3sState(msg)
	case StateLoading:
		return m.updateLoadingState(msg)
	case StateOSInfo:
		return m.updateOSInfoState(msg)
	case StateCheckingSwap:
		return m.updateCheckingSwapState(msg)
	case StateSwapPrompt:
		return m.updateSwapPromptState(msg)
	case StateCreatingSwap:
		return m.updateCreatingSwapState(msg)
	case StateSwapCreated:
		return m.updateSwapCreatedState(msg)
	case StateInstallingPackages:
		return m.updateInstallingPackagesState(msg)
	case StateInstallComplete:
		return m.updateInstallCompleteState(msg)
	case StateDetectingIPs:
		return m.updateDetectingIPsState(msg)
	case StateDNSConfig:
		return m.updateDNSConfigState(msg)
	case StateDNSValidation:
		return m.updateDNSValidationState(msg)
	case StateRegistryTypeSelection:
		return m.updateRegistryTypeSelectionState(msg)
	case StateExternalRegistryInput:
		return m.updateExternalRegistryInputState(msg)
	case StateInstallingK3S:
		return m.updateInstallingK3SState(msg)
	case StateInstallingUnbind:
		return m.updateInstallingUnbindState(msg)
	default:
		return m, nil
	}
}

func (m Model) View() string {
	content := m.viewState()
	if m.height <= 2 {
		return content
	}

	lines := strings.Split(content, "\n")
	maxLines := m.height - 1
	if len(lines) <= maxLines {
		return content
	}

	truncated := append(lines[:maxLines-1], m.styles.Subtle.Render("... (content truncated to fit terminal)"))
	return strings.Join(truncated, "\n")
}

func (m Model) viewState() string {
	if m.showDebugLogs {
		return viewDebugLogs(m)
	}

	switch m.state {
	case StateCheckK3s:
		return viewCheckK3s(m)
	case StateConfirmUninstallK3s:
		return viewConfirmUninstallK3s(m)
	case StateUninstallingK3s:
		return viewUninstallingK3s(m)
	case StateLoading:
		return viewLoading(m)
	case StateError:
		return viewError(m)
	case StateOSInfo:
		return viewOSInfo(m)
	case StateCheckingSwap:
		return viewCheckingSwap(m)
	case StateSwapPrompt:
		return viewSwapPrompt(m)
	case StateCreatingSwap:
		return viewCreatingSwap(m)
	case StateSwapCreated:
		return viewSwapCreated(m)
	case StateInstallingPackages:
		return viewInstallingPackages(m)
	case StateInstallComplete:
		return viewInstallComplete(m)
	case StateDetectingIPs:
		return viewDetectingIPs(m)
	case StateDNSConfig:
		return viewDNSConfig(m)
	case StateDNSValidation:
		return viewDNSValidation(m)
	case StateInstallingK3S:
		return viewInstallingK3S(m)
	case StateInstallingUnbind:
		return viewInstallingUnbind(m)
	case StateInstallationComplete:
		return viewInstallationComplete(m)
	case StateRegistryTypeSelection:
		return viewRegistryTypeSelection(m)
	case StateExternalRegistryInput:
		return viewExternalRegistryInput(m)
	default:
		return viewWelcome(m)
	}
}

func (m Model) transition(state ApplicationState, loading bool, cmds ...tea.Cmd) (Model, tea.Cmd) {
	m.state = state
	m.isLoading = loading
	return m, tea.Batch(cmds...)
}

func (m Model) fail(err error) (Model, tea.Cmd) {
	m.err = err
	m.state = StateError
	m.isLoading = false
	return m, nil
}

func (m Model) listenForLogs() tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-m.logChan
		if !ok {
			return nil
		}
		batch := []string{msg}
		for {
			select {
			case next, ok := <-m.logChan:
				if !ok {
					return logMsg{messages: batch}
				}
				batch = append(batch, next)
			default:
				return logMsg{messages: batch}
			}
		}
	}
}

func (m Model) listenForFacts() tea.Cmd {
	return func() tea.Msg {
		fact, ok := <-m.factChan
		if !ok {
			return nil
		}
		return factMsg{fact: fact}
	}
}

func (m Model) listenForK3SProgress() tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-m.k3sProgressChan
		if !ok {
			return nil
		}
		return msg
	}
}

func (m Model) listenForPackageProgress() tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-m.packageProgressChan
		if !ok {
			return nil
		}
		return msg
	}
}

func (m Model) listenForUnbindProgress() tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-m.unbindProgressChan
		if !ok {
			return nil
		}
		return msg
	}
}
