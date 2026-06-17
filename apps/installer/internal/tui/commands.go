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

// getDiskSpaceCommand gets available disk space.
func (self Model) getDiskSpaceCommand() tea.Cmd {
	return func() tea.Msg {
		gb, err := system.GetAvailableDiskSpaceGB(self.logChan)
		return diskSpaceResultMsg{availableGB: gb, err: err}
	}
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

// startMainDNSValidation launches the DNS validation process.
//
// Validation rules:
//  1. <domain> must resolve
//  2. If wildcard DNS is detected, mark it
//  3. Always proceed to registry selection afterward
func (self Model) startMainDNSValidation() tea.Cmd {
	return func() tea.Msg {
		if self.dnsInfo == nil || self.dnsInfo.UnbindDomain == "" {
			return errMsg{err: nil}
		}

		self.log("Starting DNS validation…")

		base := strings.TrimPrefix(self.dnsInfo.Domain, "*.")

		/* -------------------------------------------------------------------- */
		// 1. unbind domain
		/* -------------------------------------------------------------------- */
		unbindValid, unbindCF := self.validateDomain(base, true)

		/* -------------------------------------------------------------------- */
		// 2. Wildcard detection via arbitrary sub‑domain
		/* -------------------------------------------------------------------- */
		wildcardValid, wildcardCF := self.detectWildcard(base)
		if wildcardValid {
			self.dnsInfo.IsWildcard = true
		}

		/* -------------------------------------------------------------------- */
		// Do not detect registry domain - we'll always prompt for it later
		/* -------------------------------------------------------------------- */

		// Always clear registry domain to force manual registry configuration
		self.dnsInfo.RegistryDomain = ""

		/* -------------------------------------------------------------------- */
		// Final decision matrix
		/* -------------------------------------------------------------------- */

		// If wildcard domain is valid, always return success
		if wildcardValid {
			self.log("Wildcard domain detected and validated successfully")
			return dnsValidationCompleteMsg{
				success:    true,
				cloudflare: wildcardCF || unbindCF,
			}
		}

		// If main domain is valid but no wildcard, return success
		if unbindValid || unbindCF {
			self.log("Main domain validated successfully")
			return dnsValidationCompleteMsg{
				success:    true,
				cloudflare: unbindCF,
			}
		}

		// Otherwise validation failed
		self.log("DNS validation failed")
		return dnsValidationCompleteMsg{
			success:    false,
			cloudflare: unbindCF || wildcardCF,
		}
	}
}

// startRegistryDNSValidation validates just the registry domain
func (self Model) startRegistryDNSValidation() tea.Cmd {
	return func() tea.Msg {
		if self.dnsInfo == nil || self.dnsInfo.RegistryDomain == "" {
			return errMsg{err: nil}
		}

		self.log("Starting registry domain validation…")

		// Validate registry domain (CF proxy *not* allowed)
		registryValid, registryCF := self.validateDomain(self.dnsInfo.RegistryDomain, false)

		if registryValid && !registryCF {
			self.log("Registry domain validated successfully")
			return dnsValidationCompleteMsg{
				success:    true,
				cloudflare: false,
			}
		} else {
			// If validation fails, don't show errors, just return false
			if registryCF {
				self.log("Registry domain is behind Cloudflare proxy, which is not allowed")
			} else {
				self.log("Registry domain validation failed")
			}

			return dnsValidationCompleteMsg{
				success:    false,
				cloudflare: registryCF,
			}
		}
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
		kubeConfig, err := installer.Install(ctx)
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
		}

		// Handle different registry configurations
		if self.dnsInfo.RegistryType == RegistrySelfHosted {
			// Self-hosted registry
			opts.UnbindRegistryDomain = self.dnsInfo.RegistryDomain
			opts.DisableRegistry = false
			self.log("Using self-hosted registry at: " + self.dnsInfo.RegistryDomain)
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

// validateRegistryCredentials checks if the provided Docker registry credentials are valid
func (self Model) validateRegistryCredentials() tea.Cmd {
	return func() tea.Msg {
		if self.dnsInfo == nil || self.dnsInfo.RegistryUsername == "" || self.dnsInfo.RegistryPassword == "" {
			return errMsg{err: nil}
		}

		username := self.dnsInfo.RegistryUsername
		password := self.dnsInfo.RegistryPassword
		host := self.dnsInfo.RegistryHost

		self.log(fmt.Sprintf("Validating registry credentials for %s on %s...", username, host))

		// Registry-specific authentication method
		var authURL string
		var client *http.Client
		var req *http.Request
		var err error

		// Default is Docker Hub
		if host == "docker.io" {
			// Docker Hub authentication URL
			authURL = "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/alpine:pull"

			// Create HTTP client
			client = &http.Client{
				Timeout: 10 * time.Second,
			}

			// Create the request
			req, err = http.NewRequest("GET", authURL, nil)
			if err != nil {
				self.log(fmt.Sprintf("Error creating request: %s", err.Error()))
				return registryValidationCompleteMsg{success: false}
			}

			// Add basic auth header
			req.SetBasicAuth(username, password)
		} else {
			// Generic registry API check
			self.log(fmt.Sprintf("Using generic authentication for %s", host))

			// Use the catalog endpoint as a generic check
			authURL = fmt.Sprintf("https://%s/v2/_catalog", host)

			// Create HTTP client
			client = &http.Client{
				Timeout: 10 * time.Second,
			}

			// Create the request
			req, err = http.NewRequest("GET", authURL, nil)
			if err != nil {
				self.log(fmt.Sprintf("Error creating request: %s", err.Error()))
				return registryValidationCompleteMsg{success: false}
			}

			// Add basic auth header
			req.SetBasicAuth(username, password)
		}

		// Make the request
		self.log(fmt.Sprintf("Connecting to %s...", host))
		resp, err := client.Do(req)
		if err != nil {
			self.log(fmt.Sprintf("Connection error: %s", err.Error()))
			return registryValidationCompleteMsg{success: false}
		}
		defer resp.Body.Close()

		// Check response status
		if resp.StatusCode == 200 || resp.StatusCode == 401 && resp.Header.Get("Www-Authenticate") != "" {
			self.log("Authentication successful!")
			return registryValidationCompleteMsg{success: true}
		} else {
			self.log(fmt.Sprintf("Authentication failed with status: %d", resp.StatusCode))
			return registryValidationCompleteMsg{success: false}
		}
	}
}
