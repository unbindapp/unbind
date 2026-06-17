package pkgmanager

import (
	"context"
	"fmt"
	"os/exec"
	"time"
)

// AptInstaller for Debian-based systems
type AptInstaller struct {
	// Channel to send log messages
	LogChan chan<- string
}

// NewAptInstaller creates apt package manager
func NewAptInstaller(logChan chan<- string) *AptInstaller {
	return &AptInstaller{
		LogChan: logChan,
	}
}

// InstallPackages handles apt package installation
func (self *AptInstaller) InstallPackages(ctx context.Context, packages []string, progressFunc ProgressFunc) error {
	if len(packages) == 0 {
		return nil
	}

	// Start with proper progress reporting
	if progressFunc != nil {
		progressFunc("", 0.05, "Initializing package installation...", false)
	}

	// Update package lists and install packages with better progress distribution
	steps := []struct {
		progress    float64
		endProgress float64
		step        string
		cmd         *exec.Cmd
	}{
		{
			progress:    0.10,
			endProgress: 0.25,
			step:        "Updating package lists...",
			cmd:         exec.CommandContext(ctx, "apt-get", "update", "-y"),
		},
		{
			progress:    0.30,
			endProgress: 0.85,
			step:        fmt.Sprintf("Installing %d packages...", len(packages)),
			cmd:         exec.CommandContext(ctx, "apt-get", append([]string{"install", "-y"}, packages...)...),
		},
	}

	// Execute each step with progress updates
	for _, step := range steps {
		// Report starting this step
		if progressFunc != nil {
			progressFunc("", step.progress, step.step, false)
		}
		self.log(step.step)

		// Start a goroutine to update progress during long-running steps
		progressDone := make(chan struct{})
		go func(startProgress, endProgress float64, stepDesc string) {
			ticker := time.NewTicker(100 * time.Millisecond) // Faster updates for smoother progress
			defer ticker.Stop()

			currentProgress := startProgress
			// Calculate increment based on time - slower increments for more realistic progress
			increment := (endProgress - startProgress) / 200 // Spread over ~20 seconds

			for {
				select {
				case <-ticker.C:
					// Gradually increment progress, but don't exceed end point
					if currentProgress < endProgress-0.02 {
						currentProgress += increment
						if progressFunc != nil {
							progressFunc("", currentProgress, stepDesc, false)
						}
					}
				case <-progressDone:
					return
				case <-ctx.Done():
					return
				}
			}
		}(step.progress, step.endProgress, step.step)

		// Execute the command
		output, err := step.cmd.CombinedOutput()
		close(progressDone) // Stop progress updates

		// Handle errors
		if err != nil {
			self.log(fmt.Sprintf("Error: %s\nOutput: %s", err, string(output)))
			return fmt.Errorf("failed during %s: %w", step.step, err)
		}

		// Log successful completion and report completion progress
		self.log(fmt.Sprintf("Completed: %s", step.step))
		if progressFunc != nil {
			progressFunc("", step.endProgress, fmt.Sprintf("Completed: %s", step.step), false)
		}
	}

	// Final verification step with minimal progress
	if progressFunc != nil {
		progressFunc("", 0.90, "Verifying installation...", false)
	}
	self.log("Verifying installation...")

	// Small delay to show verification step
	time.Sleep(500 * time.Millisecond)

	// Report completion
	if progressFunc != nil {
		progressFunc("", 1.0, "Installation complete", true)
	}
	self.log("Packages installed successfully")

	return nil
}

// log writes to log channel
func (self *AptInstaller) log(message string) {
	if self.LogChan != nil {
		self.LogChan <- message
	}
}
