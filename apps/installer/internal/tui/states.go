package tui

import "time"

type ApplicationState int

const (
	StateWelcome ApplicationState = iota
	StateCheckK3s
	StateConfirmUninstallK3s
	StateUninstallingK3s
	StateLoading
	StateOSInfo
	StateCheckingSwap
	StateSwapPrompt
	StateCreatingSwap
	StateSwapCreated
	StateInstallingPackages
	StateInstallComplete
	StateError
	StateDetectingIPs
	StateDNSConfig
	StateDNSValidation
	StateRegistryTypeSelection
	StateExternalRegistryInput
	StateInstallingK3S
	StateInstallingUnbind
	StateInstallationComplete
)

type RegistryType int

const (
	RegistrySelfHosted RegistryType = iota
	RegistryExternal
)

type dnsInfo struct {
	UnbindDomain     string
	WildcardResolved bool
	InternalIP       string
	ExternalIP       string
	RegistryType     RegistryType
	RegistryUsername string
	RegistryPassword string
	RegistryHost     string
}

type validationStatus struct {
	gen          int
	inFlight     bool
	startedAt    time.Time
	lastAt       time.Time
	lastDuration time.Duration
	result       *dnsValidationResultMsg
}

func (v validationStatus) ready(rt RegistryType) bool {
	if v.result == nil || !v.result.mainResolved {
		return false
	}
	return rt == RegistrySelfHosted || v.result.credentialsValid
}
