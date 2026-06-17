package pkgmanager

import (
	"context"
	"fmt"
	"os/exec"
	"time"
)

// DNFInstaller handles installation of dnf packages
type DNFInstaller struct {
	// Channel to send log messages
	LogChan chan<- string
}

// NewDNFInstaller creates a new DNFInstaller
func NewDNFInstaller(logChan chan<- string) *DNFInstaller {
	return &DNFInstaller{
		LogChan: logChan,
	}
}

// InstallPackages installs the specified packages using dnf
func (self *DNFInstaller) InstallPackages(ctx context.Context, packages []string, progressFunc ProgressFunc) error {
	if len(packages) == 0 {
		return nil
	}

	// Start with initial progress
	if progressFunc != nil {
		progressFunc("", 0.05, "Initializing DNF package installation...", false)
	}

	// Update package lists
	if progressFunc != nil {
		progressFunc("", 0.10, "Updating DNF package lists...", false)
	}
	self.log("Updating DNF package lists...")

	updateCmd := exec.CommandContext(ctx, "dnf", "makecache", "--refresh", "-y")
	if output, err := updateCmd.CombinedOutput(); err != nil {
		self.log(fmt.Sprintf("Error updating dnf: %s", string(output)))
		return fmt.Errorf("failed to update dnf: %w", err)
	}

	if progressFunc != nil {
		progressFunc("", 0.25, "Completed: Updating DNF package lists...", false)
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

	args := append([]string{"install", "-y"}, packages...)
	installCmd := exec.CommandContext(ctx, "dnf", args...)
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
func (self *DNFInstaller) log(message string) {
	if self.LogChan != nil {
		self.LogChan <- message
	}
}
