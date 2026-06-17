package schema

import (
	"reflect"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
)

// * Custom kubernetes-like types
type HostSpec struct {
	PrevHost   *string `json:"prev_host,omitempty" required:"false" doc:"Previous host for the service, used for upserting key"`
	Host       string  `json:"host"`
	Path       string  `json:"path"`
	TargetPort *int32  `json:"target_port,omitempty" required:"false"`
}

func AsV1HostSpecs(hosts []HostSpec) []v1.HostSpec {
	v1Hosts := make([]v1.HostSpec, len(hosts))
	for i, host := range hosts {
		v1Hosts[i] = v1.HostSpec{
			Host: host.Host,
			Path: host.Path,
			Port: host.TargetPort,
		}
	}
	return v1Hosts
}

type PortSpec struct {
	// Will create a node port (public) service
	IsNodePort bool   `json:"is_nodeport" required:"false"`
	NodePort   *int32 `json:"node_port,omitempty" required:"false"`
	// Port is the container port to expose
	Port     int32     `json:"port" min:"1" max:"65535"`
	Protocol *Protocol `json:"protocol,omitempty" required:"false"`
}

func (self *PortSpec) AsV1PortSpec() v1.PortSpec {
	var protocol *corev1.Protocol
	if self.Protocol != nil {
		protocol = utils.ToPtr(corev1.Protocol(*self.Protocol))
	} else {
		protocol = utils.ToPtr(corev1.ProtocolTCP)
	}
	return v1.PortSpec{
		NodePort: self.NodePort,
		Port:     self.Port,
		Protocol: protocol,
	}
}

type Protocol string

const (
	ProtocolTCP  Protocol = "TCP"
	ProtocolUDP  Protocol = "UDP"
	ProtocolSCTP Protocol = "SCTP"
)

// Values provides list valid values for Enum.
func (s Protocol) Values() (kinds []string) {
	kinds = append(kinds, []string{
		string(ProtocolTCP),
		string(ProtocolUDP),
		string(ProtocolSCTP),
	}...)
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u Protocol) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["Protocol"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "Protocol")
		schemaRef.Title = "Protocol"
		schemaRef.Enum = append(schemaRef.Enum, []any{
			string(ProtocolTCP),
			string(ProtocolUDP),
			string(ProtocolSCTP),
		}...)
		r.Map()["Protocol"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/Protocol"}
}

func AsV1PortSpecs(ports []PortSpec) []v1.PortSpec {
	v1Ports := make([]v1.PortSpec, len(ports))
	for i, port := range ports {
		v1Ports[i] = port.AsV1PortSpec()
	}
	return v1Ports
}

// * For mounting variables as volumes
type VariableMount struct {
	Name string `json:"name" required:"true" doc:"Name of the variable to mount"`
	Path string `json:"path" required:"true" doc:"Path to mount the variable (e.g. /etc/secret)"`
}

func AsV1VariableMounts(mounts []*VariableMount) []v1.VariableMountSpec {
	v1Mounts := make([]v1.VariableMountSpec, len(mounts))
	for i, mount := range mounts {
		v1Mounts[i] = v1.VariableMountSpec{
			Name: mount.Name,
			Path: mount.Path,
		}
	}
	return v1Mounts
}

// * For volumes
type ServiceVolume struct {
	ID        string `json:"id" required:"true" doc:"ID of the volume, pvc name in kubernetes"`
	MountPath string `json:"mount_path" required:"true" doc:"Path to mount the volume (e.g. /mnt/data)"`
}

func AsV1Volumes(volumes []ServiceVolume) []v1.VolumeSpec {
	v1Volumes := make([]v1.VolumeSpec, len(volumes))
	for i, volume := range volumes {
		v1Volumes[i] = v1.VolumeSpec{
			Name:      volume.ID,
			MountPath: volume.MountPath,
		}
	}
	return v1Volumes
}

// * Resources
// Resources defines the resource requirements/limits for a container
type Resources struct {
	// CPU requests and limits
	CPURequestsMillicores int64 `json:"cpu_requests_millicores,omitempty"`
	CPULimitsMillicores   int64 `json:"cpu_limits_millicores,omitempty"`
	// Memory requests and limits
	MemoryRequestsMegabytes int64 `json:"memory_requests_megabytes,omitempty"`
	MemoryLimitsMegabytes   int64 `json:"memory_limits_megabytes,omitempty"`
}

func (self *Resources) AsV1ResourceSpec() *v1.ResourceSpec {
	resourceSpec := &v1.ResourceSpec{}
	if self.CPURequestsMillicores > 0 {
		resourceSpec.CPURequestsMillicores = self.CPURequestsMillicores
	} else {
		// Default to 50m if not set
		resourceSpec.CPURequestsMillicores = 50
	}
	if self.CPULimitsMillicores > 0 {
		resourceSpec.CPULimitsMillicores = self.CPULimitsMillicores
	}
	if self.MemoryRequestsMegabytes > 0 {
		resourceSpec.MemoryRequestsMegabytes = self.MemoryRequestsMegabytes
	} else {
		// Default to 64Mi if not set
		resourceSpec.MemoryRequestsMegabytes = 64
	}
	if self.MemoryLimitsMegabytes > 0 {
		resourceSpec.MemoryLimitsMegabytes = self.MemoryLimitsMegabytes
	}
	return resourceSpec
}

// * Health check compatible with unbind-operator
type HealthCheckType string

const (
	HealthCheckTypeHTTP HealthCheckType = "http"
	HealthCheckTypeExec HealthCheckType = "exec"
	HealthCheckTypeNone HealthCheckType = "none"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u HealthCheckType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["HealthCheckType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "HealthCheckType")
		schemaRef.Title = "HealthCheckType"
		schemaRef.Enum = append(schemaRef.Enum, []any{
			string(HealthCheckTypeHTTP),
			string(HealthCheckTypeExec),
			string(HealthCheckTypeNone),
		}...)
		r.Map()["HealthCheckType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/HealthCheckType"}
}

type HealthCheck struct {
	Type                    *HealthCheckType `json:"type,omitempty" required:"false"`
	Path                    string           `json:"path,omitempty" required:"false" doc:"Path for http health checks"`
	Port                    *int32           `json:"port,omitempty" required:"false" doc:"Port for http health checks" min:"1" max:"65535"`
	Command                 string           `json:"command,omitempty" required:"false" doc:"Command for exec health checks"`
	StartupPeriodSeconds    *int32           `json:"startup_period_seconds,omitempty" doc:"How often to perform the startup probe"`
	StartupTimeoutSeconds   *int32           `json:"startup_timeout_seconds,omitempty" doc:"How long to wait before marking the startup probe as failed"`
	StartupFailureThreshold *int32           `json:"startup_failure_threshold,omitempty" doc:"Failure threshold for startup probes"`
	HealthPeriodSeconds     *int32           `json:"health_period_seconds,omitempty" doc:"How often to perform the health probe"`
	HealthTimeoutSeconds    *int32           `json:"health_timeout_seconds,omitempty" doc:"How long to wait before marking the health probe as failed"`
	HealthFailureThreshold  *int32           `json:"health_failure_threshold,omitempty" doc:"Failure threshold for health probes"`
}

func (self *HealthCheck) Validate() error {
	self.ApplyDefaults()
	if *self.Type == HealthCheckTypeExec && self.Command == "" {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "command must be set for exec health checks")
	}
	if *self.Type == HealthCheckTypeHTTP && (self.Path == "" || self.Port == nil) {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "path and port must be set for http health checks")
	}
	return nil
}

func (self *HealthCheck) ApplyDefaults() {
	if self.Type == nil {
		self.Type = utils.ToPtr(HealthCheckTypeHTTP)
	}
	if *self.Type == HealthCheckTypeExec {
		self.Path = ""
		self.Port = nil
	}
	if *self.Type == HealthCheckTypeHTTP {
		self.Command = ""
	}
	if self.StartupPeriodSeconds == nil {
		self.StartupPeriodSeconds = utils.ToPtr(int32(3))
	}
	if self.StartupTimeoutSeconds == nil {
		self.StartupTimeoutSeconds = utils.ToPtr(int32(5))
	}
	if self.StartupFailureThreshold == nil {
		self.StartupFailureThreshold = utils.ToPtr(int32(30))
	}
	if self.HealthPeriodSeconds == nil {
		self.HealthPeriodSeconds = utils.ToPtr(int32(10))
	}
	if self.HealthTimeoutSeconds == nil {
		self.HealthTimeoutSeconds = utils.ToPtr(int32(5))
	}
	if self.HealthFailureThreshold == nil {
		self.HealthFailureThreshold = utils.ToPtr(int32(3))
	}
}

func (self *HealthCheck) AsV1HealthCheck() *v1.HealthCheckSpec {
	if self == nil {
		return nil
	}
	if self.Type == nil {
		self.Type = utils.ToPtr(HealthCheckTypeHTTP)
	}
	healthCheck := &v1.HealthCheckSpec{
		Type:                    string(*self.Type),
		Port:                    self.Port,
		StartupPeriodSeconds:    self.StartupPeriodSeconds,
		StartupTimeoutSeconds:   self.StartupTimeoutSeconds,
		StartupFailureThreshold: self.StartupFailureThreshold,
		HealthPeriodSeconds:     self.HealthPeriodSeconds,
		HealthTimeoutSeconds:    self.HealthTimeoutSeconds,
		HealthFailureThreshold:  self.HealthFailureThreshold,
	}
	if self.Path != "" {
		healthCheck.Path = self.Path
	}
	if self.Command != "" {
		healthCheck.Command = self.Command
	}
	return healthCheck
}

// * Init containers
type InitContainer struct {
	Image   string `json:"image" required:"true" doc:"Image of the init container"`
	Command string `json:"command" required:"true" doc:"Command to run in the init container"`
}

func AsV1InitContainers(initContainers []*InitContainer) []v1.InitContainerSpec {
	v1InitContainers := make([]v1.InitContainerSpec, len(initContainers))
	for i, initContainer := range initContainers {
		v1InitContainers[i] = v1.InitContainerSpec{
			Image:   initContainer.Image,
			Command: initContainer.Command,
		}
	}
	return v1InitContainers
}

// * Kubernetes Security context
type Capability string

// Adds and removes POSIX capabilities from running containers.
type Capabilities struct {
	Add  []Capability `json:"add,omitempty" protobuf:"bytes,1,rep,name=add,casttype=Capability"`
	Drop []Capability `json:"drop,omitempty" protobuf:"bytes,2,rep,name=drop,casttype=Capability"`
}

type SecurityContext struct {
	Capabilities *Capabilities `json:"capabilities,omitempty" protobuf:"bytes,1,opt,name=capabilities"`
	Privileged   *bool         `json:"privileged,omitempty" protobuf:"varint,2,opt,name=privileged"`
}

func (self *SecurityContext) AsV1SecurityContext() *corev1.SecurityContext {
	if self == nil {
		return nil
	}
	secCtx := &corev1.SecurityContext{}
	if self.Privileged != nil {
		secCtx.Privileged = self.Privileged
	}
	if self.Capabilities != nil {
		secCtx.Capabilities = &corev1.Capabilities{}
		if self.Capabilities.Add != nil {
			secCtx.Capabilities.Add = make([]corev1.Capability, len(self.Capabilities.Add))
			for i, cap := range self.Capabilities.Add {
				secCtx.Capabilities.Add[i] = corev1.Capability(cap)
			}
		}
		if self.Capabilities.Drop != nil {
			secCtx.Capabilities.Drop = make([]corev1.Capability, len(self.Capabilities.Drop))
			for i, cap := range self.Capabilities.Drop {
				secCtx.Capabilities.Drop[i] = corev1.Capability(cap)
			}
		}
	}
	return secCtx
}

type DatabaseConfig struct {
	Version             string `json:"version,omitempty" required:"false" description:"Version of the database"`
	StorageSize         string `json:"storage,omitempty" required:"false" description:"Storage size for the database"`
	DefaultDatabaseName string `json:"defaultDatabaseName,omitempty" required:"false" description:"Default database name"`
	InitDB              string `json:"initdb,omitempty" required:"false" description:"SQL commands to run to initialize the database"`
	WalLevel            string `json:"walLevel,omitempty" required:"false" description:"PostgreSQL WAL level"`
}

func (self *DatabaseConfig) AsV1DatabaseConfig() *v1.DatabaseConfigSpec {
	if self == nil {
		return nil
	}
	dbConfig := &v1.DatabaseConfigSpec{
		Version:             self.Version,
		StorageSize:         self.StorageSize,
		DefaultDatabaseName: self.DefaultDatabaseName,
		InitDB:              self.InitDB,
		WalLevel:            self.WalLevel,
	}
	return dbConfig
}

//* Enums

// Builder enum
type ServiceBuilder string

const (
	ServiceBuilderRailpack ServiceBuilder = "railpack"
	ServiceBuilderDocker   ServiceBuilder = "docker"
	ServiceBuilderDatabase ServiceBuilder = "database"
)

var allServiceBuilders = []ServiceBuilder{
	ServiceBuilderRailpack,
	ServiceBuilderDocker,
	ServiceBuilderDatabase,
}

// Values provides list valid values for Enum.
func (s ServiceBuilder) Values() (kinds []string) {
	for _, s := range allServiceBuilders {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u ServiceBuilder) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["ServiceBuilder"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "ServiceBuilder")
		schemaRef.Title = "ServiceBuilder"
		for _, v := range allServiceBuilders {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["ServiceBuilder"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/ServiceBuilder"}
}
