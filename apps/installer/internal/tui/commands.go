package tui

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"golang.org/x/net/publicsuffix"

	"github.com/unbindapp/unbind-installer/internal/errdefs"
	unbindInstaller "github.com/unbindapp/unbind-installer/internal/installer"
	"github.com/unbindapp/unbind-installer/internal/k3s"
	"github.com/unbindapp/unbind-installer/internal/network"
	"github.com/unbindapp/unbind-installer/internal/osinfo"
	"github.com/unbindapp/unbind-installer/internal/pkgmanager"
	"github.com/unbindapp/unbind-installer/internal/registry"
	"github.com/unbindapp/unbind-installer/internal/system"
)

func (m Model) log(msg string) {
	m.logChan <- msg
}

func checkK3sCommand() tea.Cmd {
	return func() tea.Msg {
		result, err := k3s.CheckInstalled()
		return k3sCheckResultMsg{checkResult: result, err: err}
	}
}

func (m Model) uninstallK3sCommand(scriptPath string) tea.Cmd {
	return func() tea.Msg {
		return k3sUninstallCompleteMsg{err: k3s.Uninstall(scriptPath, m.logChan)}
	}
}

func detectOSInfo() tea.Msg {
	if os.Geteuid() != 0 {
		return errMsg{err: errdefs.ErrNotRoot}
	}

	info, err := osinfo.GetOSInfo()
	if err != nil {
		return errMsg{err: err}
	}
	return osInfoMsg{info: info}
}

func (m Model) checkSwapCommand() tea.Cmd {
	return func() tea.Msg {
		isEnabled, err := system.CheckSwapActive(m.logChan)
		return swapCheckResultMsg{isEnabled: isEnabled, err: err}
	}
}

func (m Model) decideSwapCommand() tea.Cmd {
	return func() tea.Msg {
		diskGB, err := system.GetAvailableDiskSpaceGB(m.logChan)
		if err != nil {
			return swapDecisionMsg{err: err}
		}

		ramGB, err := system.GetTotalRAMGB(m.logChan)
		if err != nil {
			return swapDecisionMsg{err: err}
		}

		size := system.RecommendSwapSizeGB(ramGB, diskGB)
		m.log(fmt.Sprintf("Detected %.1f GB RAM and %.1f GB free disk; recommended swap: %d GB", ramGB, diskGB, size))
		return swapDecisionMsg{sizeGB: size}
	}
}

func (m Model) createSwapCommand(sizeGB int) tea.Cmd {
	return func() tea.Msg {
		return swapCreateResultMsg{err: system.CreateSwapFile(sizeGB, m.logChan)}
	}
}

func (m Model) installRequiredPackages() tea.Cmd {
	return func() tea.Msg {
		packages := pkgmanager.GetDistributionPackages(m.osInfo.Distribution)

		pm, err := pkgmanager.NewPackageManager(m.osInfo.Distribution, m.logChan)
		if err != nil {
			return errMsg{err: err}
		}

		startTime := time.Now()
		progressFunc := func(packageName string, progress float64, step string, isComplete bool) {
			msg := packageInstallProgressMsg{
				packageName: packageName,
				progress:    progress,
				step:        step,
				isComplete:  isComplete,
				startTime:   startTime,
			}
			if isComplete {
				msg.endTime = time.Now()
			}

			select {
			case m.packageProgressChan <- msg:
			default:
				m.log(fmt.Sprintf("Warning: Package progress channel is full (progress: %.1f%%)", progress*100))
			}
		}

		if err := pm.InstallPackages(context.Background(), packages, progressFunc); err != nil {
			return errMsg{err: err}
		}
		return installCompleteMsg{}
	}
}

func (m Model) startDetectingIPs() tea.Cmd {
	return func() tea.Msg {
		ipInfo, err := network.DetectIPs(m.log)
		if err != nil {
			m.log("Error detecting IPs: " + err.Error())
			return errMsg{err: errdefs.ErrNetworkDetectionFailed}
		}
		return detectIPsCompleteMsg{ipInfo: ipInfo}
	}
}

func (m Model) validateConfig(gen int, checkRegistry bool) tea.Cmd {
	info := m.dnsInfo
	return func() tea.Msg {
		start := time.Now()
		m.log("Checking DNS records for " + info.UnbindDomain + "…")

		main := network.CheckDomain(info.UnbindDomain, info.ExternalIP, m.log)
		probe := fmt.Sprintf("unbind-probe-%d.%s", time.Now().Unix(), info.UnbindDomain)
		wildcard := network.CheckDomain(probe, info.ExternalIP, m.log)

		result := dnsValidationResultMsg{
			gen:                gen,
			mainResolved:       main.Resolved(),
			mainIPs:            main.IPs,
			mainCloudflare:     main.Cloudflare,
			wildcardResolved:   wildcard.Resolved(),
			wildcardCloudflare: wildcard.Cloudflare,
			wildcardProxied:    wildcard.Cloudflare && isDeepWildcard(info.UnbindDomain),
		}

		if checkRegistry && info.RegistryType == RegistryExternal {
			m.log(fmt.Sprintf("Validating registry credentials for %s on %s...", info.RegistryUsername, info.RegistryHost))
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			err := registry.CheckCredentials(ctx, info.RegistryHost, info.RegistryUsername, info.RegistryPassword)
			result.registryChecked = true
			result.credentialsValid = err == nil
			if err != nil {
				result.credentialsErr = err.Error()
				m.log("Registry credential check failed: " + err.Error())
			}
		}

		result.duration = time.Since(start)
		return result
	}
}

// Cloudflare's Universal SSL covers the apex and one wildcard level only, so a
// proxied wildcard below the zone apex breaks per-service HTTPS.
func isDeepWildcard(domain string) bool {
	etld1, err := publicsuffix.EffectiveTLDPlusOne(domain)
	if err != nil {
		return false
	}
	return !strings.EqualFold(domain, etld1)
}

func (m Model) installK3S() tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		kubeConfig, err := k3s.NewInstaller(m.logChan, m.k3sProgressChan, m.factChan).Install(ctx, m.dnsInfo.RegistryType == RegistrySelfHosted)
		if err != nil {
			m.log(fmt.Sprintf("K3S installation failed: %s", err.Error()))
			return errMsg{err: errdefs.NewCustomError(errdefs.ErrTypeK3sInstallFailed, fmt.Sprintf("K3S installation failed: %s", err.Error()))}
		}

		installer, err := unbindInstaller.NewUnbindInstaller(kubeConfig, m.logChan, m.unbindProgressChan, m.factChan)
		if err != nil {
			m.log(fmt.Sprintf("Failed to create Unbind installer: %s", err.Error()))
			return errMsg{err: errdefs.NewCustomError(errdefs.ErrTypeK3sInstallFailed, "Failed to create Unbind installer")}
		}

		return k3sInstallCompleteMsg{unbindInstaller: installer}
	}
}

func (m Model) installUnbind() tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		opts := unbindInstaller.SyncHelmfileOptions{
			UnbindDomain: m.dnsInfo.UnbindDomain,
			Ref:          m.version,
		}
		if m.dnsInfo.WildcardResolved {
			opts.BaseDomain = m.dnsInfo.UnbindDomain
		}

		switch m.dnsInfo.RegistryType {
		case RegistrySelfHosted:
			opts.RegistryClusterIP = k3s.RegistryClusterIP
			m.log("Using self-hosted in-cluster registry at " + k3s.RegistryInternalHost)
		case RegistryExternal:
			opts.RegistryUsername = m.dnsInfo.RegistryUsername
			opts.RegistryPassword = m.dnsInfo.RegistryPassword
			opts.RegistryHost = m.dnsInfo.RegistryHost
			opts.DisableRegistry = true
			m.log(fmt.Sprintf("Using external registry %s with account: %s", m.dnsInfo.RegistryHost, m.dnsInfo.RegistryUsername))
		}

		if err := m.unbindInstaller.SyncHelmfileWithSteps(ctx, opts); err != nil {
			m.log(fmt.Sprintf("Unbind installation failed: %s", err.Error()))
			return errMsg{err: errdefs.NewCustomError(errdefs.ErrTypeUnbindInstallFailed, fmt.Sprintf("Unbind installation failed: %s", err.Error()))}
		}
		return unbindInstallCompleteMsg{}
	}
}
