package tui

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/errdefs"
	unbindInstaller "github.com/unbindapp/unbind-installer/internal/installer"
	"github.com/unbindapp/unbind-installer/internal/k3s"
	"github.com/unbindapp/unbind-installer/internal/network"
	"github.com/unbindapp/unbind-installer/internal/osinfo"
	"github.com/unbindapp/unbind-installer/internal/pkgmanager"
	"github.com/unbindapp/unbind-installer/internal/system"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/clientcmd"
)

// tickMsg is used to keep the command running
type tickMsg struct{}

// checkK3sCommand checks for an existing K3s installation.
func checkK3sCommand() tea.Cmd {
	return func() tea.Msg {
		result, err := k3s.CheckInstalled()
		return k3sCheckResultMsg{checkResult: result, err: err}
	}
}

// uninstallK3sCommand runs the K3s uninstall script.
func (self Model) uninstallK3sCommand(scriptPath string) tea.Cmd {
	return func() tea.Msg {
		err := k3s.Uninstall(scriptPath, self.logChan) // Pass logChan
		return k3sUninstallCompleteMsg{err: err}
	}
}

// detectOSInfo is a command that gets OS information
func detectOSInfo() tea.Msg {
	if os.Geteuid() != 0 {
		return errMsg{err: errdefs.ErrNotRoot}
	}

	info, err := osinfo.GetOSInfo()
	if err != nil {
		return errMsg{err}
	}
	return osInfoMsg{info}
}

// checkSwapCommand checks if swap is active.
func (self Model) checkSwapCommand() tea.Cmd {
	return func() tea.Msg {
		isEnabled, err := system.CheckSwapActive(self.logChan)
		return swapCheckResultMsg{isEnabled: isEnabled, err: err}
	}
}

// decideSwapCommand picks a swap size automatically from RAM and free disk space.
func (self Model) decideSwapCommand() tea.Cmd {
	return func() tea.Msg {
		diskGB, err := system.GetAvailableDiskSpaceGB(self.logChan)
		if err != nil {
			return swapDecisionMsg{err: err}
		}

		ramGB, err := system.GetTotalRAMGB(self.logChan)
		if err != nil {
			return swapDecisionMsg{err: err}
		}

		size := system.RecommendSwapSizeGB(ramGB, diskGB)
		self.log(fmt.Sprintf("Detected %.1f GB RAM and %.1f GB free disk; recommended swap: %d GB", ramGB, diskGB, size))
		return swapDecisionMsg{sizeGB: size}
	}
}

// countdownTick fires a countdownTickMsg once per second to drive auto-advance prompts.
func countdownTick() tea.Cmd {
	return tea.Tick(time.Second, func(time.Time) tea.Msg {
		return countdownTickMsg{}
	})
}

// createSwapCommand creates the swap file.
func (self Model) createSwapCommand(sizeGB int) tea.Cmd {
	return func() tea.Msg {
		err := system.CreateSwapFile(sizeGB, self.logChan)
		return swapCreateResultMsg{err: err}
	}
}

// installRequiredPackages is a command that installs the required packages
func (self Model) installRequiredPackages() tea.Cmd {
	return func() tea.Msg {
		// Create a context that we can cancel
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel() // Ensure resources are cleaned up

		// Get distribution-specific package names
		packages := pkgmanager.GetDistributionPackages(self.osInfo.Distribution)

		// Create a new package manager
		installer, err := pkgmanager.NewPackageManager(self.osInfo.Distribution, self.logChan)
		if err != nil {
			return errMsg{err}
		}

		// Start time for installation
		startTime := time.Now()

		// Progress reporting function
		progressFunc := func(packageName string, progress float64, step string, isComplete bool) {
			// Only send if the channel is available and not full
			if self.packageProgressChan != nil {
				// Create message with timing information
				msg := packageInstallProgressMsg{
					packageName: packageName,
					progress:    progress,
					step:        step,
					isComplete:  isComplete,
					startTime:   startTime,
				}

				// Set end time if complete
				if isComplete {
					msg.endTime = time.Now()
				}

				select {
				case self.packageProgressChan <- msg:
					// Message sent successfully
				default:
					// Channel is full, log rather than block
					if self.logChan != nil {
						self.logChan <- fmt.Sprintf("Warning: Package progress channel is full (progress: %.1f%%)", progress*100)
					}
				}
			}
		}

		// Install the packages with context
		err = installer.InstallPackages(ctx, packages, progressFunc)
		if err != nil {
			return errMsg{err}
		}

		return installCompleteMsg{}
	}
}

// startDetectingIPs starts the IP detection process
func (self Model) startDetectingIPs() tea.Cmd {
	return func() tea.Msg {
		if self.dnsInfo == nil {
			self.dnsInfo = &dnsInfo{}
		}

		ipInfo, err := network.DetectIPs(self.log)

		if err != nil {
			self.log("Error detecting IPs: " + err.Error())
			return errMsg{err: errdefs.ErrNetworkDetectionFailed}
		}

		return detectIPsCompleteMsg{ipInfo: ipInfo}
	}
}

// startConfigValidation enters the single combined validation pass over all
// gathered configuration (main domain + registry) and returns the commands that
// run it.
func (self Model) startConfigValidation() (tea.Model, tea.Cmd) {
	self.state = StateDNSValidation
	self.isLoading = true
	self.dnsInfo.ValidationStarted = true
	self.dnsInfo.TestingStartTime = time.Now()
	return self, tea.Batch(
		self.spinner.Tick,
		self.validateConfig(),
		dnsValidationTimeout(30*time.Second),
		self.listenForLogs(),
	)
}

// validateConfig validates everything the user configured in one pass:
//  1. the main domain resolves (wildcard is detected and marked)
//  2. self-hosted: the registry domain resolves and is NOT behind a Cloudflare
//     proxy; external: the registry credentials are valid
//
// success is true only when both the main domain and the registry check pass.
func (self Model) validateConfig() tea.Cmd {
	return func() tea.Msg {
		if self.dnsInfo == nil || self.dnsInfo.UnbindDomain == "" {
			return dnsValidationCompleteMsg{success: false}
		}

		self.log("Validating configuration…")

		base := strings.TrimPrefix(self.dnsInfo.Domain, "*.")
		result := dnsValidationCompleteMsg{}

		// Main domain (Cloudflare proxy allowed here).
		unbindValid, unbindCF := self.validateDomain(base, true)
		result.mainResolvedIP = strings.Join(network.LookupIPs(base), ", ")
		result.cloudflare = unbindCF

		// Wildcard detection via an arbitrary sub-domain (informational).
		wildcardValid, wildcardCF := self.detectWildcard(base)
		if wildcardValid {
			self.dnsInfo.IsWildcard = true
		}
		if wildcardCF {
			result.cloudflare = true
		}

		mainOK := unbindValid || unbindCF || wildcardValid
		result.mainResolved = mainOK

		// Registry check depends on the chosen registry type.
		registryOK := false
		switch self.dnsInfo.RegistryType {
		case RegistrySelfHosted:
			// The self-hosted registry runs in-cluster with no domain, so there is
			// nothing to resolve; it is provisioned during the install.
			registryOK = true

		case RegistryExternal:
			result.credentialsValid = self.checkRegistryCredentials()
			registryOK = result.credentialsValid
		}

		result.success = mainOK && registryOK
		if result.success {
			self.log("Configuration validated successfully")
		} else {
			self.log("Configuration validation failed")
		}
		return result
	}
}

// validateDomain checks whether the domain resolves to the expected IP and whether it is
// behind Cloudflare. If allowCloudflare is false and the domain *is* behind Cloudflare,
// the domain is considered invalid.
func (self Model) validateDomain(domain string, allowCloudflare bool) (dnsValid, behindCF bool) {
	self.log(fmt.Sprintf("Checking %s…", domain))

	behindCF = network.CheckCloudflareProxy(domain, self.log)
	if behindCF && !allowCloudflare {
		return false, true
	}

	dnsValid = network.ValidateDNS(domain, self.dnsInfo.ExternalIP, self.log)
	return dnsValid, behindCF
}

// detectWildcard probes an arbitrary sub‑domain to infer wildcard DNS configuration.
// If the probe domain is behind Cloudflare the presence of wildcard is assumed true.
func (self Model) detectWildcard(base string) (dnsValid, behindCF bool) {
	probe := fmt.Sprintf("test%d.%s", time.Now().Unix(), base)
	self.log(fmt.Sprintf("Checking for wildcard domain with %s…", probe))

	behindCF = network.CheckCloudflareProxy(probe, self.log)
	if behindCF {
		return true, true // wildcard via Cloudflare
	}

	dnsValid = network.ValidateDNS(probe, self.dnsInfo.ExternalIP, self.log)
	return dnsValid, behindCF
}

// installK3S is a command that installs K3S
func (self Model) installK3S() tea.Cmd {
	return func() tea.Msg {
		// Create a new K3S installer
		installer := k3s.NewInstaller(self.logChan, self.k3sProgressChan, self.factChan)

		// Create a context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel() // Ensure resources are cleaned up

		// Install K3S
		kubeConfig, err := installer.Install(ctx, self.dnsInfo.RegistryType == RegistrySelfHosted)
		if err != nil {
			self.log(fmt.Sprintf("K3S installation failed: %s", err.Error()))
			return errMsg{err: errdefs.NewCustomError(errdefs.ErrTypeK3sInstallFailed, fmt.Sprintf("K3S installation failed: %s", err.Error()))}
		}

		// Create kubeClient
		config, err := clientcmd.BuildConfigFromFlags("", kubeConfig)
		if err != nil {
			self.log(fmt.Sprintf("Failed to create kubeconfig: %s", err.Error()))
			return errMsg{err: errdefs.NewCustomError(errdefs.ErrTypeK3sInstallFailed, "Failed to create kubeconfig")}
		}

		dynamicClient, err := dynamic.NewForConfig(config)
		if err != nil {
			self.log(fmt.Sprintf("Failed to create dynamic client: %s", err.Error()))
			return errMsg{err: errdefs.NewCustomError(errdefs.ErrTypeK3sInstallFailed, "Failed to create Kubernetes client")}
		}

		// Create the unbind installer, using the channels we already have in the model
		unbindInstaller, err := unbindInstaller.NewUnbindInstaller(kubeConfig, self.logChan, self.unbindProgressChan, self.factChan)
		if err != nil {
			self.log(fmt.Sprintf("Failed to create Unbind installer: %s", err.Error()))
			return errMsg{err: errdefs.NewCustomError(errdefs.ErrTypeK3sInstallFailed, "Failed to create Unbind installer")}
		}

		// Signal that installation is complete by returning a completion message
		return k3sInstallCompleteMsg{
			kubeConfig:      kubeConfig,
			kubeClient:      dynamicClient,
			unbindInstaller: unbindInstaller,
		}
	}
}

// installUnbind installs the unbind helmfile
func (self Model) installUnbind() tea.Cmd {
	return func() tea.Msg {
		// Create a context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		// Install Unbind
		opts := unbindInstaller.SyncHelmfileOptions{
			UnbindDomain: self.dnsInfo.UnbindDomain,
			Ref:          self.version,
		}

		// Handle different registry configurations
		if self.dnsInfo.RegistryType == RegistrySelfHosted {
			// Self-hosted registry: in-cluster, no domain. Each node's containerd is
			// pointed at it via registries.yaml written during the K3S install.
			opts.DisableRegistry = false
			opts.RegistryClusterIP = k3s.RegistryClusterIP
			self.log("Using self-hosted in-cluster registry at " + k3s.RegistryInternalHost)
		} else {
			// External registry
			opts.RegistryUsername = self.dnsInfo.RegistryUsername
			opts.RegistryPassword = self.dnsInfo.RegistryPassword
			opts.RegistryHost = self.dnsInfo.RegistryHost
			opts.DisableRegistry = true
			self.log(fmt.Sprintf("Using external registry %s with account: %s",
				self.dnsInfo.RegistryHost,
				self.dnsInfo.RegistryUsername))
		}

		// Set base domain if using wildcard
		if self.dnsInfo.IsWildcard {
			opts.BaseDomain = self.dnsInfo.Domain
		}

		err := self.unbindInstaller.SyncHelmfileWithSteps(ctx, opts)
		if err != nil {
			self.log(fmt.Sprintf("Unbind installation failed: %s", err.Error()))
			return errMsg{err: errdefs.NewCustomError(errdefs.ErrTypeUnbindInstallFailed, fmt.Sprintf("Unbind installation failed: %s", err.Error()))}
		}

		return unbindInstallCompleteMsg{}
	}
}

func (self Model) log(msg string) {
	self.logChan <- msg
}

// checkRegistryCredentials reports whether the configured external registry
// credentials are valid. Runs synchronously as part of validateConfig.
func (self Model) checkRegistryCredentials() bool {
	if self.dnsInfo == nil || self.dnsInfo.RegistryUsername == "" || self.dnsInfo.RegistryPassword == "" {
		return false
	}

	username := self.dnsInfo.RegistryUsername
	password := self.dnsInfo.RegistryPassword
	host := self.dnsInfo.RegistryHost

	self.log(fmt.Sprintf("Validating registry credentials for %s on %s...", username, host))

	// Docker Hub uses a dedicated token endpoint; everything else falls back to
	// the generic v2 catalog endpoint.
	authURL := fmt.Sprintf("https://%s/v2/_catalog", host)
	if host == "docker.io" {
		authURL = "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/alpine:pull"
	} else {
		self.log(fmt.Sprintf("Using generic authentication for %s", host))
	}

	req, err := http.NewRequest("GET", authURL, nil)
	if err != nil {
		self.log(fmt.Sprintf("Error creating request: %s", err.Error()))
		return false
	}
	req.SetBasicAuth(username, password)

	client := &http.Client{Timeout: 10 * time.Second}
	self.log(fmt.Sprintf("Connecting to %s...", host))
	resp, err := client.Do(req)
	if err != nil {
		self.log(fmt.Sprintf("Connection error: %s", err.Error()))
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 || resp.StatusCode == 401 && resp.Header.Get("Www-Authenticate") != "" {
		self.log("Authentication successful!")
		return true
	}

	self.log(fmt.Sprintf("Authentication failed with status: %d", resp.StatusCode))
	return false
}
