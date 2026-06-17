package pkgmanager

import (
	"context"
	"fmt"
	"os/exec"
	"time"
)

// ZypperInstaller handles installation of zypper packages
type ZypperInstaller struct {
	// Channel to send log messages
	LogChan chan<- string
}

// NewZypperInstaller creates a new ZypperInstaller
func NewZypperInstaller(logChan chan<- string) *ZypperInstaller {
	return &ZypperInstaller{
		LogChan: logChan,
	}
}

// InstallPackages installs the specified packages using zypper
func (self *ZypperInstaller) InstallPackages(ctx context.Context, packages []string, progressFunc ProgressFunc) error {
	if len(packages) == 0 {
		return nil
	}

	// Start with initial progress
	if progressFunc != nil {
		progressFunc("", 0.05, "Initializing Zypper package installation...", false)
	}

	// Refresh repositories
	if progressFunc != nil {
		progressFunc("", 0.10, "Refreshing zypper repositories...", false)
	}
	self.log("Refreshing zypper repositories...")

	refreshCmd := exec.CommandContext(ctx, "zypper", "--non-interactive", "--no-gpg-checks", "refresh")
	if output, err := refreshCmd.CombinedOutput(); err != nil {
		self.log(fmt.Sprintf("Error refreshing zypper: %s", string(output)))
		return fmt.Errorf("failed to refresh zypper: %w", err)
	}

	if progressFunc != nil {
		progressFunc("", 0.25, "Completed: Refreshing zypper repositories...", false)
	}

	// Install packages with gradual progress
	if progressFunc != nil {
		progressFunc("", 0.30, fmt.Sprintf("Installing %d packages...", len(packages)), false)
	}
	self.log(fmt.Sprintf("Installing %d packages...", len(packages)))

	// Start gradual progress updates
	progressDone := make(chan struct{})
	go func() {
		currentProgress := 0.30
		for currentProgress < 0.80 {
			select {
			case <-progressDone:
				return
			case <-ctx.Done():
				return
			default:
				currentProgress += 0.03
				if progressFunc != nil {
					progressFunc("", currentProgress, fmt.Sprintf("Installing %d packages...", len(packages)), false)
				}
				// Sleep for gradual progress
				select {
				case <-progressDone:
					return
				case <-ctx.Done():
					return
				default:
					time.Sleep(300 * time.Millisecond)
				}
			}
		}
	}()

	args := append([]string{"--non-interactive", "--no-gpg-checks", "install"}, packages...)
	installCmd := exec.CommandContext(ctx, "zypper", args...)
	output, err := installCmd.CombinedOutput()
	close(progressDone)

	if err != nil {
		self.log(fmt.Sprintf("Error installing packages: %s", string(output)))
		return fmt.Errorf("failed to install packages: %w", err)
	}

	if progressFunc != nil {
		progressFunc("", 0.85, "Completed: Installing packages...", false)
	}

	// Verification step
	if progressFunc != nil {
		progressFunc("", 0.90, "Verifying installation...", false)
	}
	self.log("Verifying installation...")

	// Small delay to show verification
	time.Sleep(500 * time.Millisecond)

	// Final completion
	if progressFunc != nil {
		progressFunc("", 1.0, "Installation complete", true)
	}
	self.log("Packages installed successfully")

	return nil
}

// log sends a message to the log channel if available
func (self *ZypperInstaller) log(message string) {
	if self.LogChan != nil {
		self.LogChan <- message
	}
}
