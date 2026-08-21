package installer

import (
	"context"
	"fmt"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

type UnbindInstaller struct {
	progressChan   chan<- UnbindInstallUpdateMsg
	kubeClient     *kubernetes.Clientset
	LogChan        chan<- string
	FactChan       chan<- string
	state          map[string]*dependencyState
	kubeConfigPath string
	// Fact rotator for educational information
	factRotator *FactRotator
}

// dependencyState tracks status info for each component
type dependencyState struct {
	name        string
	startTime   time.Time
	endTime     time.Time
	status      InstallerStatus
	progress    float64
	description string
	error       error
	stepHistory []string // History of steps executed
}

// InstallationStep represents a single installation task
type InstallationStep struct {
	Description string
	Progress    float64
	Action      func(context.Context) error
}

func NewUnbindInstaller(kubeConfig string, logChan chan<- string, progressChan chan<- UnbindInstallUpdateMsg, factChan chan<- string) (*UnbindInstaller, error) {
	config, err := clientcmd.BuildConfigFromFlags("", kubeConfig)
	if err != nil {
		logChan <- "Error creating kubeconfig: " + err.Error()
		return nil, err
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		logChan <- "Error creating Kubernetes client: " + err.Error()
		return nil, err
	}

	installer := &UnbindInstaller{
		progressChan:   progressChan,
		kubeConfigPath: kubeConfig,
		kubeClient:     clientset,
		LogChan:        logChan,
		FactChan:       factChan,
		state:          make(map[string]*dependencyState),
	}

	// Initialize fact rotator with the facts from helmfile.go
	installer.factRotator = NewFactRotator(unbindInstallationFacts)

	return installer, nil
}

// InstallDependencyWithSteps runs the installation sequence
func (self *UnbindInstaller) InstallDependencyWithSteps(
	ctx context.Context,
	dependencyName string,
	steps []InstallationStep,
) error {
	// Initialize dependency state
	self.ensureStateInitialized(dependencyName)

	// Mark the start of installation
	self.logProgress(dependencyName, 0.0, fmt.Sprintf("Starting installation of %s", dependencyName), nil, StatusInstalling)

	totalSteps := len(steps)

	// Execute each step
	for i, step := range steps {
		select {
		case <-ctx.Done():
			self.logProgress(dependencyName, step.Progress,
				fmt.Sprintf("Installation canceled: %s", step.Description), ctx.Err(), StatusFailed)
			return ctx.Err()
		default:
			// Progress through the steps
			stepDescription := fmt.Sprintf("Step %d/%d: %s", i+1, totalSteps, step.Description)
			self.logProgress(dependencyName, step.Progress, stepDescription, nil, StatusInstalling)

			startTime := time.Now()

			if err := step.Action(ctx); err != nil {
				failMsg := fmt.Sprintf("Step %d/%d failed: %s - %v", i+1, totalSteps, step.Description, err)
				self.logProgress(dependencyName, step.Progress, failMsg, err, StatusFailed)
				return err
			}

			duration := time.Since(startTime).Round(time.Millisecond)
			self.sendLog(fmt.Sprintf("Step %d/%d completed in %v", i+1, totalSteps, duration))
		}
	}

	// Mark installation as complete
	self.logProgress(dependencyName, 1.0, fmt.Sprintf("Installation of %s completed successfully", dependencyName), nil, StatusCompleted)
	return nil
}

// ensureStateInitialized sets up tracking if needed
func (self *UnbindInstaller) ensureStateInitialized(name string) {
	if _, exists := self.state[name]; !exists {
		self.state[name] = &dependencyState{
			name:        name,
			status:      StatusPending,
			progress:    0.0,
			stepHistory: []string{},
		}
	}
}

// InstallerStatus - possible status values
type InstallerStatus string

const (
	StatusPending    InstallerStatus = "pending"
	StatusInstalling InstallerStatus = "installing"
	StatusCompleted  InstallerStatus = "completed"
	StatusFailed     InstallerStatus = "failed"
)

// UnbindInstallUpdateMsg for UI progress updates
type UnbindInstallUpdateMsg struct {
	Name        string
	Status      InstallerStatus
	Description string
	Progress    float64
	Error       error
	StartTime   time.Time // Start time of the installation
	EndTime     time.Time // End time of the installation
	StepHistory []string  // History of steps executed
}

// logProgress handles all state/progress tracking
func (self *UnbindInstaller) logProgress(name string, progress float64, description string, err error, status InstallerStatus) {
	// Ensure state is initialized
	self.ensureStateInitialized(name)

	// Send log message
	if description != "" {
		self.sendLog(description)
	}

	// Update the state
	state := self.state[name]

	// Update status if changed
	if status != state.status {
		if status == StatusInstalling && state.startTime.IsZero() {
			state.startTime = time.Now()
		} else if status == StatusCompleted || status == StatusFailed {
			state.endTime = time.Now()
		}
		state.status = status
	}

	// Update progress and description
	state.progress = progress
	state.description = description
	state.error = err

	// Always add to step history if it's a new step
	if description != "" && (len(state.stepHistory) == 0 || state.stepHistory[len(state.stepHistory)-1] != description) {
		state.stepHistory = append(state.stepHistory, description)
		// Force an update when step history changes
		self.sendUpdateMessage(name)
	} else {
		// For progress updates without description changes
		self.sendUpdateMessage(name)
	}
}

// sendUpdateMessage pushes updates to the UI
func (self *UnbindInstaller) sendUpdateMessage(name string) {
	if self.progressChan == nil {
		return
	}

	state := self.state[name]
	if state == nil {
		return
	}

	// Create message from current state
	msg := UnbindInstallUpdateMsg{
		Name:        name,
		Status:      state.status,
		Description: state.description,
		Progress:    state.progress,
		Error:       state.error,
		StartTime:   state.startTime,
		EndTime:     state.endTime,
		StepHistory: make([]string, len(state.stepHistory)), // Make a copy to avoid mutation issues
	}
	copy(msg.StepHistory, state.stepHistory)

	select {
	case self.progressChan <- msg:
		// Message sent successfully
	default:
		// Channel is full, log it but don't block
		self.sendLog(fmt.Sprintf("Warning: Progress channel for %s is full", name))
	}
}

// sendLog outputs messages to the log channel
func (self *UnbindInstaller) sendLog(message string) {
	if self.LogChan != nil {
		self.LogChan <- message
	}
}

// sendFact sends an educational fact to the UI
func (self *UnbindInstaller) sendFact(fact string) {
	if self.FactChan != nil {
		select {
		case self.FactChan <- fact:
			// Fact sent successfully
		default:
			// Channel is full, skip this fact
		}
	}
}
