package tui

import "time"

// ApplicationState represents the current state of the application
type ApplicationState int

const (
	StateWelcome ApplicationState = iota
	StateCheckK3s
	StateConfirmUninstallK3s
	StateUninstallingK3s
	StateDebugLogs
	StateLoading
	StateRootDetection
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
	StateDNSSuccess
	StateDNSFailed
	StateRegistryTypeSelection
	StateExternalRegistryInput
	StateInstallingK3S
	StateInstallingUnbind
	StateInstallationComplete
)

// Registry type enum
type RegistryType int

const (
	RegistrySelfHosted RegistryType = iota // Self-hosted registry
	RegistryExternal                       // External registry like Docker Hub
)

// Additional model fields for DNS setup
type dnsInfo struct {
	Domain             string // The base domain or wildcard domain
	UnbindDomain       string // unbind.yourdomain.com
	IsWildcard         bool   // Whether wildcard was specified
	InternalIP         string
	ExternalIP         string
	CIDR               string
	ValidationStarted  bool
	ValidationSuccess  bool
	CloudflareDetected bool
	WildcardProxied    bool
	TestingStartTime   time.Time
	ValidationDuration time.Duration

	// Per-check results captured during the combined validation pass, surfaced
	// on the failure screen.
	MainResolved   bool
	MainResolvedIP string

	// Registry configuration
	RegistryType         RegistryType
	RegistryUsername     string
	RegistryPassword     string
	RegistryHost         string
	DisableLocalRegistry bool
}
