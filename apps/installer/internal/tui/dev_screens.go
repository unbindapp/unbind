package tui

import (
	"fmt"
	"strings"

	"github.com/unbindapp/unbind-installer/internal/network"
	"github.com/unbindapp/unbind-installer/internal/osinfo"
)

var DevScreens = []string{
	"welcome",
	"k3s-confirm",
	"dns-config",
	"registry-type",
	"registry-input",
	"validation",
	"install-complete",
}

func NewDevModel(version, screen, domain string) (Model, error) {
	m := NewModel(version)
	m.osInfo = &osinfo.OSInfo{PrettyName: "Dev OS", Distribution: "ubuntu", Version: "24.04", Architecture: "amd64"}
	m.dnsInfo = dnsInfo{UnbindDomain: domain, ExternalIP: "203.0.113.10", InternalIP: "10.0.0.2"}

	switch screen {
	case "welcome":
		m.state = StateWelcome
	case "k3s-confirm":
		m.state = StateConfirmUninstallK3s
	case "dns-config":
		m.state = StateDNSConfig
		m.domainInput.SetValue(domain)
		m.initCmd = m.domainInput.Focus()
	case "registry-type":
		m.state = StateRegistryTypeSelection
	case "registry-input":
		m.state = StateExternalRegistryInput
		m.dnsInfo.RegistryType = RegistryExternal
		m.initCmd = m.usernameInput.Focus()
	case "validation":
		if info, err := network.DetectIPs(func(string) {}); err == nil {
			m.dnsInfo.ExternalIP = info.ExternalIP
		}
		m, cmd := m.startConfigValidation()
		m.initCmd = cmd
		return m, nil
	case "install-complete":
		m.state = StateInstallationComplete
	default:
		return Model{}, fmt.Errorf("unknown screen %q (available: %s)", screen, strings.Join(DevScreens, ", "))
	}
	return m, nil
}
