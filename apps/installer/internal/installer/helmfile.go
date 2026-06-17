package installer

import (
	"bufio"
	"context"
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Educational facts about Unbind and the installation process
var unbindInstallationFacts = []string{
	"You can configure webhooks for Discord, Slack, and more for various events - such as when a deployment is complete.",
	"Unbind leverages \"Railpack\" to automatically build your application, without needing to write any scripts or Dockerfiles.",
	"When you scale a service, traffic is automatically load balanced across all instances.",
	"New deployments for services are \"rolled out\" one at a time resulting in zero or minimal downtime.",
	"Unbind is MIT licensed and all source code is available on GitHub.",
	"You can add more servers to your cluster at any time, using `unbind add-node` - this will increase the compute capacity of your cluster.",
	"Unbind's template system enables zero-configuration deployments of many popular services - including Plausible, Ghost, N8N, Supabase, and more.",
	"Templates will automatically generate secure passwords, JWT tokens, and configure complex service relationships.",
	"You can view logs and metrics for individual services - or across entire teams, projects, and environments.",
	"Unbind has full CI/CD capabilities to automatically build and deploy your applications.",
	"You can create variables at the team, project, environment, or service level and reference them from other services.",
	"By configuring Memory and CPU limits you can ensure that your services are not starved of resources.",
	"You can configure S3-compatible storage and automatically backup your databases.",
	"Unbind services will be exposed on the internal, private network through a DNS-based service discovery system.",
	"Externally exposed services are automatically secured with TLS using Let's Encrypt certificates.",
	"Build caches are automatically stored in your container registry to speed up subsequent builds of the same application.",
	"Unbind automatically creates Kubernetes RBAC roles and bindings that sync with your team permissions.",
	"Database operators handle complex operations like scaling, upgrades, and maintenance automatically.",
	"You can update to a newer version of Unbind through the web interface.",
	"In addition to supporting multiple databases, Unbind also supports multiple versions of each database to ensure application compatibility.",
	"Unbind's flavor of PostgreSQL includes many popular extensions out of the box - including TimescaleDB, PostGIS, and pgvector.",
}

// FactRotator manages educational facts display without repetition
type FactRotator struct {
	facts     []string
	remaining []string
	current   int
}

// NewFactRotator creates a new fact rotator with shuffled facts
func NewFactRotator(facts []string) *FactRotator {
	rotator := &FactRotator{
		facts: make([]string, len(facts)),
	}
	copy(rotator.facts, facts)
	rotator.shuffle()
	return rotator
}

// shuffle randomizes the fact order
func (f *FactRotator) shuffle() {
	f.remaining = make([]string, len(f.facts))
	copy(f.remaining, f.facts)
	rand.Shuffle(len(f.remaining), func(i, j int) {
		f.remaining[i], f.remaining[j] = f.remaining[j], f.remaining[i]
	})
	f.current = 0
}

// GetNext returns the next fact, reshuffling when all facts are exhausted
func (f *FactRotator) GetNext() string {
	if f.current >= len(f.remaining) {
		f.shuffle() // Start over with a new shuffle
	}
	fact := f.remaining[f.current]
	f.current++
	return fact
}

// SyncHelmfileOptions defines options for the Helmfile sync operation
type SyncHelmfileOptions struct {
	BaseDomain           string
	UnbindDomain         string
	UnbindRegistryDomain string
	AdditionalValues     map[string]interface{}
	RepoURL              string
	HelmfilePath         string // path to the helmfile within the repo
	SparseDir            string // checkout only this subtree (empty = full checkout)

	// Registry configuration
	DisableRegistry  bool   // Whether to disable the local registry component
	RegistryUsername string // External registry username
	RegistryPassword string // External registry password
	RegistryHost     string // External registry host
}

// SyncHelmfileWithSteps performs a helmfile sync operation using the charts in the unbind monorepo (deploy/charts)
func (self *UnbindInstaller) SyncHelmfileWithSteps(ctx context.Context, opts SyncHelmfileOptions) error {
	var repoDir string
	dependencyName := "helmfile-sync"

	// Set defaults if not provided
	if opts.RepoURL == "" {
		opts.RepoURL = "https://github.com/unbindapp/unbind.git"
	}
	if opts.HelmfilePath == "" {
		opts.HelmfilePath = "deploy/charts/helmfile.yaml.gotmpl"
	}
	if opts.SparseDir == "" {
		opts.SparseDir = "deploy/charts"
	}

	// Initialize state for this dependency
	self.ensureStateInitialized(dependencyName)

	// Mark the beginning of installation
	self.logProgress(dependencyName, 0.0, fmt.Sprintf("Starting helmfile sync with base domain %s", opts.BaseDomain), nil, StatusInstalling)

	return self.InstallDependencyWithSteps(ctx, dependencyName, []InstallationStep{
		{
			Description: "Creating temporary directory",
			Progress:    0.02,
			Action: func(ctx context.Context) error {
				var err error
				repoDir, err = os.MkdirTemp("", "unbind-charts-*")
				if err != nil {
					return fmt.Errorf("failed to create temp directory: %w", err)
				}
				return nil
			},
		},
		{
			Description: "Cloning repository",
			Progress:    0.05,
			Action: func(ctx context.Context) error {
				self.logProgress(dependencyName, 0.05, fmt.Sprintf("Preparing to clone from %s", opts.RepoURL), nil, StatusInstalling)

				// First check if git is installed
				checkCmd := exec.CommandContext(ctx, "git", "--version")
				if err := checkCmd.Run(); err != nil {
					return fmt.Errorf("git command not found, please install git: %w", err)
				}

				// Send explicit progress update that we're starting the clone
				self.logProgress(dependencyName, 0.06, "Initializing git clone...", nil, StatusInstalling)

				// Set up progress updates during clone
				cloneDone := make(chan struct{})
				go func() {
					ticker := time.NewTicker(150 * time.Millisecond) // Faster updates
					defer ticker.Stop()

					currentProgress := 0.06
					messages := []string{
						"Initializing git clone...",
						"Connecting to repository...",
						"Receiving objects...",
						"Resolving deltas...",
						"Checking out files...",
					}
					msgIndex := 0

					for {
						select {
						case <-ticker.C:
							if currentProgress < 0.10 {
								// Increase progress increment for faster movement
								currentProgress += 0.015

								// Rotate through different messages more frequently
								if currentProgress > 0.06 && msgIndex < len(messages)-1 &&
									currentProgress > 0.06+float64(msgIndex)*0.01 {
									msgIndex++
								}

								self.logProgress(dependencyName, currentProgress, messages[msgIndex], nil, StatusInstalling)
							}
						case <-cloneDone:
							return
						case <-ctx.Done():
							return
						}
					}
				}()

				// Use timeout to prevent hanging on slow connections
				cloneCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
				defer cancel()

				cloneArgs := []string{"clone", "--depth=1"}
				if opts.SparseDir != "" {
					cloneArgs = append(cloneArgs, "--filter=blob:none", "--sparse")
				}
				cloneArgs = append(cloneArgs, opts.RepoURL, repoDir)
				cmd := exec.CommandContext(cloneCtx, "git", cloneArgs...)

				// Stream the output
				stdoutPipe, err := cmd.StdoutPipe()
				if err != nil {
					close(cloneDone)
					return fmt.Errorf("failed to create git stdout pipe: %w", err)
				}

				stderrPipe, err := cmd.StderrPipe()
				if err != nil {
					close(cloneDone)
					return fmt.Errorf("failed to create git stderr pipe: %w", err)
				}

				// Add progress update before starting the command
				self.logProgress(dependencyName, 0.07, "Starting git clone operation...", nil, StatusInstalling)

				if err := cmd.Start(); err != nil {
					close(cloneDone)
					return fmt.Errorf("failed to start git clone: %w", err)
				}

				// Stream stdout
				go func() {
					scanner := bufio.NewScanner(stdoutPipe)
					for scanner.Scan() {
						line := scanner.Text()
						self.sendLog("git: " + line)

						// Use output to trigger progress updates
						if strings.Contains(line, "Receiving objects") {
							self.logProgress(dependencyName, 0.08, "Receiving objects from repository...", nil, StatusInstalling)
						} else if strings.Contains(line, "Resolving deltas") {
							self.logProgress(dependencyName, 0.10, "Resolving deltas...", nil, StatusInstalling)
						}
					}
				}()

				// Stream stderr
				go func() {
					scanner := bufio.NewScanner(stderrPipe)
					for scanner.Scan() {
						line := scanner.Text()
						self.sendLog("git: " + line)

						// Use output to trigger progress updates
						if strings.Contains(line, "Cloning into") {
							self.logProgress(dependencyName, 0.07, "Initializing repository...", nil, StatusInstalling)
						} else if strings.Contains(line, "remote:") {
							self.logProgress(dependencyName, 0.09, "Connected to remote repository...", nil, StatusInstalling)
						}
					}
				}()

				err = cmd.Wait()
				close(cloneDone) // Signal progress updates to stop

				if err != nil {
					return fmt.Errorf("failed to clone repository: %w", err)
				}

				if opts.SparseDir != "" {
					sparseCmd := exec.CommandContext(cloneCtx, "git", "-C", repoDir, "sparse-checkout", "set", opts.SparseDir)
					if out, err := sparseCmd.CombinedOutput(); err != nil {
						return fmt.Errorf("failed to sparse-checkout %s: %w: %s", opts.SparseDir, err, out)
					}
				}

				// Signal cloning is complete with another explicit update
				self.logProgress(dependencyName, 0.08, "Repository cloned successfully", nil, StatusInstalling)

				// Signal moving to next step
				self.logProgress(dependencyName, 0.10, fmt.Sprintf("Preparing to run helmfile in %s", repoDir), nil, StatusInstalling)

				return nil
			},
		},
		{
			Description: "Running helmfile sync",
			Progress:    0.15,
			Action: func(ctx context.Context) error {
				// Construct arguments for helmfile command
				args := []string{
					"--file", filepath.Join(repoDir, opts.HelmfilePath),
					"--state-values-set", "unbindDomain=" + opts.UnbindDomain,
					"--state-values-set", "unbindRegistryDomain=" + opts.UnbindRegistryDomain,
					"--state-values-set", "wildcardBaseDomain=" + opts.BaseDomain,
				}

				// Add registry configuration options
				if opts.DisableRegistry {
					// Configure external registry
					args = append(args, "--state-values-set", "externalRegistry.enabled=true")

					// Set host if provided, default to docker.io
					registryHost := "docker.io"
					if opts.RegistryHost != "" {
						registryHost = opts.RegistryHost
					}
					args = append(args, "--state-values-set", "externalRegistry.host="+registryHost)

					// Add registry credentials if using external registry
					if opts.RegistryUsername != "" {
						args = append(args, "--state-values-set", "externalRegistry.username="+opts.RegistryUsername)
					}

					if opts.RegistryPassword != "" {
						args = append(args, "--state-values-set", "externalRegistry.password="+opts.RegistryPassword)
					}
				} else {
					// Use self-hosted registry
					args = append(args, "--state-values-set", "externalRegistry.enabled=false")
				}

				// Add any additional values if present
				for key, value := range opts.AdditionalValues {
					args = append(args, "--state-values-set", fmt.Sprintf("%s=%v", key, value))
				}

				// Add final "sync" command
				args = append(args, "sync")

				// Immediately report that we're starting the helmfile sync
				self.logProgress(dependencyName, 0.15, "Preparing helmfile command...", nil, StatusInstalling)

				// Show progress as we prepare to run the command
				self.logProgress(dependencyName, 0.16, "Starting helmfile sync operation...", nil, StatusInstalling)

				// Start educational facts rotation during the long helmfile sync
				factsDone := make(chan struct{})
				go func() {
					// Show first fact immediately
					fact := self.factRotator.GetNext()
					self.sendFact(fact)

					ticker := time.NewTicker(8 * time.Second) // Show a new fact every 8 seconds
					defer ticker.Stop()

					for {
						select {
						case <-ticker.C:
							fact := self.factRotator.GetNext()
							self.sendFact(fact)
						case <-factsDone:
							return
						case <-ctx.Done():
							return
						}
					}
				}()

				// Set up the command to run helmfile sync
				cmd := exec.CommandContext(ctx, "helmfile", args...)
				cmd.Env = append(os.Environ(), fmt.Sprintf("KUBECONFIG=%s", self.kubeConfigPath))
				cmd.Dir = repoDir

				// Start progress updates during wait
				waitDone := make(chan error, 1)

				// Basic progress updates
				progressStages := []struct {
					progress    float64
					baseMessage string
				}{
					{0.20, "Initializing Kubernetes cluster"},
					{0.30, "Installing core components"},
					{0.45, "Configuring authentication services"},
					{0.60, "Setting up networking"},
					{0.75, "Finalizing installation"},
				}

				// Start progress stage updates
				go func() {
					ticker := time.NewTicker(15 * time.Second) // Update stages every 15 seconds
					defer ticker.Stop()
					stageIndex := 0

					for {
						select {
						case <-ticker.C:
							if stageIndex < len(progressStages) {
								stage := progressStages[stageIndex]
								self.logProgress(dependencyName, stage.progress, stage.baseMessage, nil, StatusInstalling)
								stageIndex++
							}
						case <-factsDone:
							return
						case <-ctx.Done():
							return
						}
					}
				}()

				// Create pipes for stdout/stderr
				stdoutPipe, err := cmd.StdoutPipe()
				if err != nil {
					close(factsDone)
					close(waitDone)
					return fmt.Errorf("failed to create stdout pipe: %w", err)
				}

				stderrPipe, err := cmd.StderrPipe()
				if err != nil {
					close(factsDone)
					close(waitDone)
					return fmt.Errorf("failed to create stderr pipe: %w", err)
				}

				// Start the command
				if err := cmd.Start(); err != nil {
					close(factsDone)
					close(waitDone)
					return fmt.Errorf("failed to start helmfile sync: %w", err)
				}

				// Set up scanner for stdout
				stdoutScanner := bufio.NewScanner(stdoutPipe)
				stdoutScanner.Buffer(make([]byte, 4096), 1024*1024) // Increase buffer size

				// Set up scanner for stderr
				stderrScanner := bufio.NewScanner(stderrPipe)
				stderrScanner.Buffer(make([]byte, 4096), 1024*1024) // Increase buffer size

				// Sync start time
				syncStartTime := time.Now()
				self.sendLog(fmt.Sprintf("Helmfile sync started at %v", syncStartTime.Format(time.RFC3339)))

				// Run scanners in separate goroutines
				go func() {
					for stdoutScanner.Scan() {
						line := stdoutScanner.Text()
						self.sendLog(line)
						self.updateProgressBasedOnOutput(dependencyName, line)
					}
				}()

				go func() {
					for stderrScanner.Scan() {
						line := stderrScanner.Text()
						// Only log as error if it actually contains error-related words
						if isErrorMessage(line) {
							self.sendLog("ERROR: " + line)
						} else {
							self.sendLog(line)
						}
						self.updateProgressBasedOnOutput(dependencyName, line)
					}
				}()

				// Wait for the command to complete
				err = cmd.Wait()
				syncDuration := time.Since(syncStartTime).Round(time.Second)
				close(factsDone) // Stop showing facts
				close(waitDone)

				if err != nil {
					failMsg := fmt.Sprintf("Helmfile sync failed after %v: %v", syncDuration, err)
					self.logProgress(dependencyName, 0.15, failMsg, err, StatusFailed)
					return fmt.Errorf("helmfile sync failed after %v: %w", syncDuration, err)
				}

				self.logProgress(dependencyName, 0.90, fmt.Sprintf("Helmfile sync completed successfully in %v", syncDuration), nil, StatusInstalling)
				return nil
			},
		},
		{
			Description: "Cleaning up temporary files",
			Progress:    0.95,
			Action: func(ctx context.Context) error {
				// Clean up the temporary directory
				if repoDir != "" {
					if err := os.RemoveAll(repoDir); err != nil {
						warningMsg := fmt.Sprintf("Warning: failed to clean up repository directory %s: %v", repoDir, err)
						self.sendLog(warningMsg)
						// We'll consider this a non-fatal error
					} else {
						self.sendLog("Cleaned up temporary repository directory")
					}
				}

				return nil
			},
		},
		{
			Description: "Waiting for authentication services",
			Progress:    0.98,
			Action: func(ctx context.Context) error {
				namespace := "unbind-system"

				// Wait for kube-oidc-proxy deployment to be ready
				self.logProgress(dependencyName, 0.97, "Waiting for kube-oidc-proxy to be ready...", nil, StatusInstalling)
				cmd1 := exec.CommandContext(ctx, "kubectl", "wait", "--for=condition=available",
					"deployment/kube-oidc-proxy", "-n", namespace, "--timeout=300s")
				cmd1.Env = append(os.Environ(), fmt.Sprintf("KUBECONFIG=%s", self.kubeConfigPath))

				if output, err := cmd1.CombinedOutput(); err != nil {
					self.sendLog(fmt.Sprintf("kubectl wait kube-oidc-proxy output: %s", string(output)))
					return fmt.Errorf("failed waiting for kube-oidc-proxy deployment: %w", err)
				}
				self.sendLog("kube-oidc-proxy deployment is ready")

				return nil
			},
		},
	})
}

// writeCounter counts bytes written and updates progress
type writeCounter struct {
	Total         int64
	Downloaded    int64
	Installer     *UnbindInstaller
	Dependency    string
	LastProgress  float64
	StartProgress float64
	EndProgress   float64
}

func (wc *writeCounter) Write(p []byte) (int, error) {
	n := len(p)
	wc.Downloaded += int64(n)

	// Calculate percentage
	var percentage float64
	if wc.Total > 0 {
		percentage = float64(wc.Downloaded) / float64(wc.Total)
	} else {
		percentage = 0
	}

	// Scale the progress to our range
	scaledProgress := wc.StartProgress + (percentage * (wc.EndProgress - wc.StartProgress))

	// Only update every 1% to avoid flooding
	if scaledProgress-wc.LastProgress >= 0.01 {
		wc.Installer.logProgress(wc.Dependency, scaledProgress, "Downloading Helmfile", nil, StatusInstalling)
		wc.LastProgress = scaledProgress
	}

	return n, nil
}

// Helper function to check if we can write to a directory
func canWriteToDir(dir string) bool {
	testFile := filepath.Join(dir, ".helmfile_write_test")
	err := os.WriteFile(testFile, []byte("test"), 0644)
	if err != nil {
		return false
	}
	os.Remove(testFile)
	return true
}

// isErrorMessage checks if a line is likely an error message
func isErrorMessage(message string) bool {
	lowercaseMsg := strings.ToLower(message)
	errorKeywords := []string{"error", "fail", "fatal", "exception", "panic"}

	for _, keyword := range errorKeywords {
		if strings.Contains(lowercaseMsg, keyword) {
			return true
		}
	}

	return false
}

// updateProgressBasedOnOutput updates the progress based on the output line
func (self *UnbindInstaller) updateProgressBasedOnOutput(dependency string, output string) {
	// Match known output lines to update progress and description
	switch {
	case containsString(output, "Processing chart"):
		// Extract chart name if possible
		parts := strings.Split(output, "Processing chart ")
		chartName := "helm chart"
		if len(parts) > 1 {
			chartName = strings.TrimSpace(strings.Split(parts[1], " ")[0])
		}
		self.logProgress(dependency, 0.25, fmt.Sprintf("Processing %s", chartName), nil, StatusInstalling)

	case containsString(output, "Installing chart"):
		// Extract chart name if possible
		parts := strings.Split(output, "Installing chart ")
		chartName := "helm chart"
		if len(parts) > 1 {
			chartName = strings.TrimSpace(strings.Split(parts[1], " ")[0])
		}
		self.logProgress(dependency, 0.40, fmt.Sprintf("Installing %s", chartName), nil, StatusInstalling)

	case containsString(output, "Installing release"):
		// Extract release name if possible
		parts := strings.Split(output, "Installing release ")
		releaseName := "component"
		if len(parts) > 1 {
			releaseName = strings.TrimSpace(strings.Split(parts[1], " ")[0])
		}
		self.logProgress(dependency, 0.55, fmt.Sprintf("Installing %s", releaseName), nil, StatusInstalling)

	case containsString(output, "Building dependency release"):
		self.logProgress(dependency, 0.65, "Building dependency releases", nil, StatusInstalling)

	case containsString(output, "Upgrading release"):
		// Extract release name if possible
		parts := strings.Split(output, "Upgrading release ")
		releaseName := "component"
		if len(parts) > 1 {
			releaseName = strings.TrimSpace(strings.Split(parts[1], " ")[0])
		}
		self.logProgress(dependency, 0.75, fmt.Sprintf("Upgrading %s", releaseName), nil, StatusInstalling)

	case containsString(output, "UPDATED RELEASES:"):
		self.logProgress(dependency, 0.85, "Finalizing release updates", nil, StatusInstalling)

	case containsString(output, "Deleting release"):
		// Extract release name if possible
		parts := strings.Split(output, "Deleting release ")
		releaseName := "component"
		if len(parts) > 1 {
			releaseName = strings.TrimSpace(strings.Split(parts[1], " ")[0])
		}
		self.logProgress(dependency, 0.90, fmt.Sprintf("Cleaning up %s", releaseName), nil, StatusInstalling)

	case containsString(output, "DELETED RELEASES:") || containsString(output, "Listing releases matching"):
		self.logProgress(dependency, 0.95, "Verifying installation", nil, StatusInstalling)
	}
}

// containsString is a helper function to check if a string contains a substring
func containsString(s, substr string) bool {
	return strings.Contains(s, substr)
}
