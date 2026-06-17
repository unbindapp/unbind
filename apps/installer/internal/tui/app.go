package tui

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/installer"
	"github.com/unbindapp/unbind-installer/internal/k3s"
	"github.com/unbindapp/unbind-installer/internal/osinfo"
	"k8s.io/client-go/dynamic"
)

// Model represents the application state
type Model struct {
	// App version
	version string

	// State management
	state         ApplicationState
	showDebugLogs bool // New flag to indicate debug logs view

	// Core data
	osInfo                 *osinfo.OSInfo
	err                    error
	k3sUninstallScriptPath string
	availableDiskSpaceGB   float64
	swapSizeInput          textinput.Model
	swapSizeInputErr       error

	// UI components
	spinner   spinner.Model
	width     int
	height    int
	isLoading bool
	styles    Styles

	// Logging
	logMessages []string
	logChan     chan string

	// Educational facts
	factChan    chan string
	currentFact string

	// Feature-specific data
	dnsInfo           *dnsInfo
	domainInput       textinput.Model
	registryInput     textinput.Model
	usernameInput     textinput.Model
	passwordInput     textinput.Model
	registryHostInput textinput.Model
	selectedRegistry  int // 0=docker.io, 1=ghcr.io, 2=quay.io, 3=custom

	// Kube client
	kubeConfig      string
	kubeClient      *dynamic.DynamicClient
	unbindInstaller *installer.UnbindInstaller

	// Progress statuses
	k3sProgressChan chan k3s.K3SUpdateMessage
	k3sProgress     k3s.K3SUpdateMessage

	// Helmfile progress
	unbindProgressChan chan installer.UnbindInstallUpdateMsg
	unbindProgress     installer.UnbindInstallUpdateMsg

	// Package install progress
	packageProgressChan chan packageInstallProgressMsg
	packageProgress     packageInstallProgressMsg
}

// NewModel initializes a new Model
func NewModel(version string) Model {
	s := spinner.New()
	s.Spinner = spinner.Dot

	// Use our theme-based styles
	theme := DefaultTheme()
	styles := NewStyles(theme)

	s.Style = styles.SpinnerStyle

	// Create buffered channels to prevent blocking
	logChan := make(chan string, 1000)
	progressChan := make(chan installer.UnbindInstallUpdateMsg, 100)
	packageProgressChan := make(chan packageInstallProgressMsg, 100)
	k3sProgressChan := make(chan k3s.K3SUpdateMessage, 100)

	// Initialize domain input
	domainInput := initializeDomainInput()

	// Initialize registry input
	registryInput := initializeRegistryInput()

	// Initialize username and password inputs
	usernameInput := initializeUsernameInput()
	passwordInput := initializePasswordInput()

	// Initialize registry host input
	registryHostInput := textinput.New()
	registryHostInput.Placeholder = "registry.example.com"
	registryHostInput.Width = 30
	registryHostInput.Prompt = ""

	// Initialize swap input
	swapInput := textinput.New()
	swapInput.Placeholder = "e.g., 4"
	swapInput.CharLimit = 4
	swapInput.Width = 10
	swapInput.Prompt = "Enter Swap Size (GB): "
	swapInput.Validate = func(s string) error {
		if s == "" {
			return nil // Allow empty initially
		}
		_, err := strconv.Atoi(s)
		if err != nil {
			return fmt.Errorf("must be a number")
		}
		return nil
	}

	// Initialize channels
	model := Model{
		version:            version,
		state:              StateWelcome,
		showDebugLogs:      false, // Initialize debug logs flag
		spinner:            s,
		isLoading:          false,
		styles:             styles,
		logMessages:        []string{},
		logChan:            logChan,
		unbindProgressChan: progressChan,
		k3sProgressChan:    k3sProgressChan,
		k3sProgress: k3s.K3SUpdateMessage{
			Progress:    0.0,
			Status:      "pending",
			Description: "Initializing K3S installation",
		},
		unbindProgress: installer.UnbindInstallUpdateMsg{
			Name:        "unbind",
			Status:      installer.StatusPending,
			Progress:    0.0,
			Description: "Initializing Unbind installation",
		},
		packageProgress: packageInstallProgressMsg{
			progress:   0.0,
			step:       "Initializing package installation",
			isComplete: false,
		},
		domainInput:         domainInput,
		registryInput:       registryInput,
		usernameInput:       usernameInput,
		passwordInput:       passwordInput,
		registryHostInput:   registryHostInput,
		selectedRegistry:    0, // Default to Docker Hub
		swapSizeInput:       swapInput,
		packageProgressChan: packageProgressChan,
		factChan:            make(chan string, 10),
	}

	return model
}

// Init is the Bubble Tea initialization function
func (self Model) Init() tea.Cmd {
	// Create a batch of initial commands
	cmds := []tea.Cmd{
		self.spinner.Tick, // Start the spinner
		self.listenForLogs(),
		self.listenForFacts(),
	}

	return tea.Batch(cmds...)
}

// Update handles messages and user input
func (self Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Handle global key events first
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		case "ctrl+c":
			return self, tea.Quit
		case "ctrl+d":
			if self.state != StateDNSConfig && self.state != StateExternalRegistryInput && self.state != StateRegistryDomainInput {
				// Toggle debug logs view
				self.showDebugLogs = !self.showDebugLogs
				return self, nil
			}
		}
	}

	// Process spinner ticks (needed for all loading states)
	if tickMsg, ok := msg.(spinner.TickMsg); ok {
		var cmd tea.Cmd
		self.spinner, cmd = self.spinner.Update(tickMsg)
		return self, tea.Batch(cmd, self.listenForLogs())
	}

	// Process window size messages (applies to all states)
	if sizeMsg, ok := msg.(tea.WindowSizeMsg); ok {
		self.width = sizeMsg.Width
		self.height = sizeMsg.Height
	}

	// Process log messages (applies to all states)
	if logMsg, ok := msg.(logMsg); ok {
		self.logMessages = append(self.logMessages, logMsg.message)
		return self, self.listenForLogs()
	}

	// Process fact messages (applies to all states)
	if factMsg, ok := msg.(factMsg); ok {
		self.currentFact = factMsg.fact
		return self, self.listenForFacts()
	}

	// Handle progress channel cleanup signals
	if _, ok := msg.(k3sProgressCompletedMsg); ok {
		// Stop listening for k3s progress updates
		return self, nil
	}

	if _, ok := msg.(packageProgressCompletedMsg); ok {
		// Stop listening for package progress updates
		return self, nil
	}

	if _, ok := msg.(unbindProgressCompletedMsg); ok {
		// Stop listening for unbind progress updates
		return self, nil
	}

	// Delegate to state-specific handlers
	var model tea.Model
	var cmd tea.Cmd

	switch self.state {
	case StateWelcome:
		model, cmd = self.updateWelcomeState(msg)
	case StateCheckK3s:
		model, cmd = self.updateCheckK3sState(msg)
	case StateConfirmUninstallK3s:
		model, cmd = self.updateConfirmUninstallK3sState(msg)
	case StateUninstallingK3s:
		model, cmd = self.updateUninstallingK3sState(msg)
	case StateLoading:
		model, cmd = self.updateLoadingState(msg)
	case StateOSInfo:
		model, cmd = self.updateOSInfoState(msg)
	case StateCheckingSwap:
		model, cmd = self.updateCheckingSwapState(msg)
	case StateConfirmCreateSwap:
		model, cmd = self.updateConfirmCreateSwapState(msg)
	case StateEnterSwapSize:
		model, cmd = self.updateEnterSwapSizeState(msg)
	case StateCreatingSwap:
		model, cmd = self.updateCreatingSwapState(msg)
	case StateSwapCreated:
		model, cmd = self.updateSwapCreatedState(msg)
	case StateInstallingPackages:
		model, cmd = self.updateInstallingPackagesState(msg)
	case StateInstallComplete:
		model, cmd = self.updateInstallCompleteState(msg)
	case StateDetectingIPs:
		model, cmd = self.updateDetectingIPsState(msg)
	case StateDNSConfig:
		model, cmd = self.updateDNSConfigState(msg)
	case StateDNSValidation:
		model, cmd = self.updateDNSValidationState(msg)
	case StateDNSSuccess:
		model, cmd = self.updateDNSSuccessState(msg)
	case StateDNSFailed:
		model, cmd = self.updateDNSFailedState(msg)
	case StateRegistryTypeSelection:
		model, cmd = self.updateRegistryTypeSelectionState(msg)
	case StateRegistryDomainInput:
		model, cmd = self.updateRegistryDomainInputState(msg)
	case StateRegistryDNSValidation:
		model, cmd = self.updateRegistryDNSValidationState(msg)
	case StateExternalRegistryInput:
		model, cmd = self.updateExternalRegistryInputState(msg)
	case StateExternalRegistryValidation:
		model, cmd = self.updateExternalRegistryValidationState(msg)
	case StateError:
		model, cmd = self.updateErrorState(msg)
	case StateInstallingK3S:
		model, cmd = self.updateInstallingK3SState(msg)
	case StateInstallingUnbind:
		model, cmd = self.updateInstallingUnbindState(msg)
	case StateInstallationComplete:
		model, cmd = self.updateInstallationCompleteState(msg)
	default:
		return self, self.listenForLogs()
	}

	// Type assert the model back to our Model type
	newModel, _ := model.(Model)

	// Preserve the debug logs flag
	newModel.showDebugLogs = self.showDebugLogs

	// Ensure progress listeners are always active for installation states
	// This fixes race conditions where listeners might not start properly
	switch newModel.state {
	case StateInstallingPackages:
		if newModel.packageProgressChan != nil {
			cmd = tea.Batch(cmd, newModel.listenForPackageProgress())
		}
		if newModel.factChan != nil {
			cmd = tea.Batch(cmd, newModel.listenForFacts())
		}
	case StateInstallingK3S:
		if newModel.k3sProgressChan != nil {
			cmd = tea.Batch(cmd, newModel.listenForK3SProgress())
		}
		if newModel.factChan != nil {
			cmd = tea.Batch(cmd, newModel.listenForFacts())
		}
	case StateInstallingUnbind:
		if newModel.unbindProgressChan != nil {
			cmd = tea.Batch(cmd, newModel.listenForUnbindProgress())
		}
		if newModel.factChan != nil {
			cmd = tea.Batch(cmd, newModel.listenForFacts())
		}
	}

	return newModel, cmd
}

// View delegates to the appropriate view function based on state
func (self Model) View() string {
	var content string

	// If debug logs are shown, show that view regardless of state
	if self.showDebugLogs {
		content = viewDebugLogs(self)
	} else {
		// Otherwise show the current state's view
		switch self.state {
		case StateWelcome:
			content = viewWelcome(self)
		case StateCheckK3s:
			content = viewCheckK3s(self)
		case StateConfirmUninstallK3s:
			content = viewConfirmUninstallK3s(self)
		case StateUninstallingK3s:
			content = viewUninstallingK3s(self)
		case StateLoading:
			content = viewLoading(self)
		case StateError:
			content = viewError(self)
		case StateOSInfo:
			content = viewOSInfo(self)
		case StateCheckingSwap:
			content = viewCheckingSwap(self)
		case StateConfirmCreateSwap:
			content = viewConfirmCreateSwap(self)
		case StateEnterSwapSize:
			content = viewEnterSwapSize(self)
		case StateCreatingSwap:
			content = viewCreatingSwap(self)
		case StateSwapCreated:
			content = viewSwapCreated(self)
		case StateInstallingPackages:
			content = viewInstallingPackages(self)
		case StateInstallComplete:
			content = viewInstallComplete(self)
		case StateDetectingIPs:
			content = viewDetectingIPs(self)
		case StateDNSConfig:
			content = viewDNSConfig(self)
		case StateDNSValidation:
			content = viewDNSValidation(self)
		case StateDNSSuccess:
			content = viewDNSSuccess(self)
		case StateDNSFailed:
			content = viewDNSFailed(self)
		case StateInstallingK3S:
			content = viewInstallingK3S(self)
		case StateInstallingUnbind:
			content = viewInstallingUnbind(self)
		case StateInstallationComplete:
			content = viewInstallationComplete(self)
		case StateRegistryTypeSelection:
			content = viewRegistryTypeSelection(self)
		case StateRegistryDomainInput:
			content = viewRegistryDomainInput(self)
		case StateRegistryDNSValidation:
			content = viewRegistryDNSValidation(self)
		case StateExternalRegistryInput:
			content = viewExternalRegistryInput(self)
		case StateExternalRegistryValidation:
			content = viewExternalRegistryValidation(self)
		default:
			content = viewWelcome(self)
		}
	}

	// Ensure content fits within terminal bounds and handle potential overflow
	if self.height > 0 {
		lines := strings.Split(content, "\n")
		maxLines := self.height - 1 // Leave space for potential command prompt

		if len(lines) > maxLines {
			// Truncate content to fit in terminal height
			truncatedLines := lines[:maxLines-1]
			// Add an indicator that content was truncated
			truncatedLines = append(truncatedLines, self.styles.Subtle.Render("... (content truncated to fit terminal)"))
			content = strings.Join(truncatedLines, "\n")
		}
	}

	return content
}

// transition is a helper to cleanly transition between states
func (self Model) transition(newState ApplicationState, isLoading bool, additionalCmds ...tea.Cmd) (tea.Model, tea.Cmd) {
	// Update model state directly
	self.state = newState
	self.isLoading = isLoading

	cmds := []tea.Cmd{}

	// Add spinner tick if loading
	if isLoading {
		cmds = append(cmds, self.spinner.Tick)
	}

	// Add all additional commands
	cmds = append(cmds, additionalCmds...)

	// Process state transition with all commands
	return self.processStateUpdate(tea.Batch(cmds...))
}

// listenForLogs returns a command that listens for log messages
func (self Model) listenForLogs() tea.Cmd {
	return func() tea.Msg {
		select {
		case msg, ok := <-self.logChan:
			if !ok {
				// Channel closed
				return nil
			}
			return logMsg{message: msg}
		default:
			// Don't block if no message is available
			return nil
		}
	}
}

// listenForK3SProgress returns a command that listens for K3S progress messages
func (self Model) listenForK3SProgress() tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-self.k3sProgressChan
		if !ok {
			// Channel closed, send completion message to stop this listener
			return k3sProgressCompletedMsg{}
		}
		// Check if this is a completion message (progress = 1.0 and status = completed)
		if msg.Progress >= 1.0 && msg.Status == "completed" {
			// Send a completion signal to stop further listening
			return k3sProgressCompletedMsg{}
		}
		return msg
	}
}

// listenForPackageProgress returns a command that listens for package installation progress
func (self Model) listenForPackageProgress() tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-self.packageProgressChan
		if !ok {
			// Channel closed, send completion message to stop this listener
			return packageProgressCompletedMsg{}
		}
		// Check if this is a completion message (isComplete = true)
		if msg.isComplete {
			// Send a completion signal to stop further listening
			return packageProgressCompletedMsg{}
		}
		return msg
	}
}

// listenForUnbindProgress returns a command that listens for unbind installation progress
func (self Model) listenForUnbindProgress() tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-self.unbindProgressChan
		if !ok {
			// Channel closed, send completion message to stop this listener
			return unbindProgressCompletedMsg{}
		}
		// Check if this is a completion message (progress = 1.0 and status = completed)
		if msg.Progress >= 1.0 && msg.Status == installer.StatusCompleted {
			// Send a completion signal to stop further listening
			return unbindProgressCompletedMsg{}
		}
		return msg
	}
}

// listenForFacts returns a command that listens for educational facts
func (self Model) listenForFacts() tea.Cmd {
	return func() tea.Msg {
		fact, ok := <-self.factChan
		if !ok {
			// Channel closed
			return nil
		}
		return factMsg{fact: fact}
	}
}

// progressListenerMap defines which states need which progress listeners
var progressListenerMap = map[ApplicationState]struct {
	pkgInstallListener    bool
	k3sInstallListener    bool
	unbindInstallListener bool
	factListener          bool
}{
	StateInstallingPackages: {pkgInstallListener: true, factListener: true},
	StateInstallingK3S:      {k3sInstallListener: true, factListener: true},
	StateInstallingUnbind:   {unbindInstallListener: true, factListener: true},
}

// processStateUpdate is a helper function to batch common commands for state updates
func (self Model) processStateUpdate(cmd tea.Cmd, additionalCmds ...tea.Cmd) (tea.Model, tea.Cmd) {
	allCmds := []tea.Cmd{cmd, self.listenForLogs()}

	// Get listener configuration for current state
	listeners, hasMapping := progressListenerMap[self.state]

	// Add appropriate listeners based on current state
	if hasMapping {
		// Package installation progress listener
		if listeners.pkgInstallListener && self.packageProgressChan != nil {
			allCmds = append(allCmds, self.listenForPackageProgress())
		}

		// K3S installation progress listener
		if listeners.k3sInstallListener && self.k3sProgressChan != nil {
			allCmds = append(allCmds, self.listenForK3SProgress())
		}

		// Unbind installation progress listener
		if listeners.unbindInstallListener && self.unbindProgressChan != nil {
			allCmds = append(allCmds, self.listenForUnbindProgress())
		}

		// Fact listener for installation states
		if listeners.factListener && self.factChan != nil {
			allCmds = append(allCmds, self.listenForFacts())
		}
	}

	// Add any additional commands
	allCmds = append(allCmds, additionalCmds...)

	return self, tea.Batch(allCmds...)
}
