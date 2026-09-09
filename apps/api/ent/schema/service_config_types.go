package schema

import (
	"fmt"
	"reflect"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
)

// * Custom kubernetes-like types
type HostSpec struct {
	PrevHost   *string       `json:"prev_host,omitempty" required:"false" doc:"Previous host for the service, used for upserting key"`
	Host       string        `json:"host"`
	Path       string        `json:"path"`
	TargetPort *int32        `json:"target_port,omitempty" required:"false"`
	Protocol   *HostProtocol `json:"protocol,omitempty" required:"false" doc:"Application protocol for the domain: http (default) or grpc"`
	// Template input metadata, snapshotted at deploy time and preserved across edits
	TemplateInputID *string `json:"template_input_id,omitempty" required:"false"`
	DisplayName     *string `json:"display_name,omitempty" required:"false" doc:"Human label from the template input, e.g. Cloud Domain"`
	Description     *string `json:"description,omitempty" required:"false"`
}

// VariableMetadata describes a deployed variable, sourced from a template input.
type VariableMetadata struct {
	TemplateInputID *string `json:"template_input_id,omitempty"`
	DisplayName     string  `json:"display_name,omitempty"`
	Description     string  `json:"description,omitempty"`
}

// HostProtocol is the application-layer protocol for a domain route.
type HostProtocol string

const (
	HostProtocolHTTP HostProtocol = "http"
	HostProtocolGRPC HostProtocol = "grpc"
)

func (s HostProtocol) Values() (kinds []string) {
	return []string{string(HostProtocolHTTP), string(HostProtocolGRPC)}
}

func AsV1HostSpecs(hosts []HostSpec) []v1.HostSpec {
	v1Hosts := make([]v1.HostSpec, len(hosts))
	for i, host := range hosts {
		protocol := ""
		if host.Protocol != nil {
			protocol = string(*host.Protocol)
		}
		v1Hosts[i] = v1.HostSpec{
			Host:     host.Host,
			Path:     host.Path,
			Port:     host.TargetPort,
			Protocol: protocol,
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
// Resources holds what the user or a template stored. Requests act as floors; the
// deployed request is derived from the limit by ResolveResources.
type Resources struct {
	CPURequestsMillicores   int64 `json:"cpu_requests_millicores,omitempty" minimum:"-1"`
	CPULimitsMillicores     int64 `json:"cpu_limits_millicores,omitempty" minimum:"-1"`
	MemoryRequestsMegabytes int64 `json:"memory_requests_megabytes,omitempty" minimum:"-1"`
	MemoryLimitsMegabytes   int64 `json:"memory_limits_megabytes,omitempty" minimum:"-1"`
}

const (
	requestShareOfLimitPercent  int64 = 5
	cpuRequestFloorMillicores   int64 = 50
	cpuRequestCapMillicores     int64 = 500
	memoryRequestFloorMegabytes int64 = 64
	memoryRequestCapMegabytes   int64 = 1024
)

func DefaultDatabaseResources() *Resources {
	return &Resources{
		CPURequestsMillicores:   50,
		CPULimitsMillicores:     1000,
		MemoryRequestsMegabytes: 128,
		MemoryLimitsMegabytes:   2048,
	}
}

func (self *Resources) HasNegative() bool {
	if self == nil {
		return false
	}
	return self.CPURequestsMillicores < 0 || self.CPULimitsMillicores < 0 ||
		self.MemoryRequestsMegabytes < 0 || self.MemoryLimitsMegabytes < 0
}

// Validate rejects a stored request above its limit; -1 means "clear" on update.
func (self *Resources) Validate() error {
	if self == nil {
		return nil
	}
	if self.CPURequestsMillicores > 0 && self.CPULimitsMillicores > 0 && self.CPURequestsMillicores > self.CPULimitsMillicores {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "CPU request cannot exceed the CPU limit")
	}
	if self.MemoryRequestsMegabytes > 0 && self.MemoryLimitsMegabytes > 0 && self.MemoryRequestsMegabytes > self.MemoryLimitsMegabytes {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Memory request cannot exceed the memory limit")
	}
	return nil
}

// ResolveResources builds the spec the operator deploys. Every service gets a
// request: a share of the limit clamped to a floor and a cap, never below the
// stored request and never above the limit. Without a limit the floor applies.
func ResolveResources(res *Resources) *v1.ResourceSpec {
	if res == nil {
		res = &Resources{}
	}
	return &v1.ResourceSpec{
		CPURequestsMillicores:   deriveRequest(res.CPURequestsMillicores, res.CPULimitsMillicores, cpuRequestFloorMillicores, cpuRequestCapMillicores),
		CPULimitsMillicores:     max(res.CPULimitsMillicores, 0),
		MemoryRequestsMegabytes: deriveRequest(res.MemoryRequestsMegabytes, res.MemoryLimitsMegabytes, memoryRequestFloorMegabytes, memoryRequestCapMegabytes),
		MemoryLimitsMegabytes:   max(res.MemoryLimitsMegabytes, 0),
	}
}

func deriveRequest(stored, limit, floor, ceiling int64) int64 {
	stored = max(stored, 0)
	if limit <= 0 {
		return max(stored, floor)
	}
	derived := min(max(limit*requestShareOfLimitPercent/100, floor), ceiling)
	return min(max(derived, stored), limit)
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

type WalLevel string

const (
	WalLevelReplica WalLevel = "replica"
	WalLevelLogical WalLevel = "logical"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u WalLevel) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["WalLevel"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "WalLevel")
		schemaRef.Title = "WalLevel"
		schemaRef.Enum = append(schemaRef.Enum, []any{
			string(WalLevelReplica),
			string(WalLevelLogical),
		}...)
		r.Map()["WalLevel"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/WalLevel"}
}

type DatabaseConfig struct {
	Version             string `json:"version,omitempty" required:"false" description:"Version of the database"`
	StorageSize         string `json:"storage,omitempty" required:"false" description:"Storage size for the database"`
	DefaultDatabaseName string `json:"defaultDatabaseName,omitempty" required:"false" description:"Default database name"`
	InitDB              string `json:"initdb,omitempty" required:"false" description:"SQL commands to run to initialize the database"`
	// PostgreSQL only. On update, unset fields keep their stored value
	WalLevel             WalLevel `json:"walLevel,omitempty" required:"false" description:"PostgreSQL wal_level"`
	MaxReplicationSlots  *int     `json:"maxReplicationSlots,omitempty" required:"false" minimum:"0" maximum:"1000" description:"PostgreSQL max_replication_slots, 0 uses the default"`
	MaxWalSenders        *int     `json:"maxWalSenders,omitempty" required:"false" minimum:"0" maximum:"1000" description:"PostgreSQL max_wal_senders, 0 uses the default"`
	MaxSlotWalKeepSizeMB *int     `json:"maxSlotWalKeepSizeMb,omitempty" required:"false" minimum:"0" description:"PostgreSQL max_slot_wal_keep_size in megabytes, 0 is unlimited"`
}

// Update requests carry only the fields they change
func MergeDatabaseConfig(existing, patch *DatabaseConfig) *DatabaseConfig {
	if patch == nil {
		return existing
	}
	merged := DatabaseConfig{}
	if existing != nil {
		merged = *existing
	}
	if patch.Version != "" {
		merged.Version = patch.Version
	}
	if patch.StorageSize != "" {
		merged.StorageSize = patch.StorageSize
	}
	if patch.DefaultDatabaseName != "" {
		merged.DefaultDatabaseName = patch.DefaultDatabaseName
	}
	if patch.InitDB != "" {
		merged.InitDB = patch.InitDB
	}
	if patch.WalLevel != "" {
		merged.WalLevel = patch.WalLevel
	}
	if patch.MaxReplicationSlots != nil {
		merged.MaxReplicationSlots = patch.MaxReplicationSlots
	}
	if patch.MaxWalSenders != nil {
		merged.MaxWalSenders = patch.MaxWalSenders
	}
	if patch.MaxSlotWalKeepSizeMB != nil {
		merged.MaxSlotWalKeepSizeMB = patch.MaxSlotWalKeepSizeMB
	}
	return &merged
}

func (self *DatabaseConfig) AsV1DatabaseConfig() (*v1.DatabaseConfigSpec, error) {
	if self == nil {
		return nil, nil
	}
	dbConfig := &v1.DatabaseConfigSpec{
		Version:              self.Version,
		DefaultDatabaseName:  self.DefaultDatabaseName,
		InitDB:               self.InitDB,
		WalLevel:             string(self.WalLevel),
		MaxReplicationSlots:  intOrZero(self.MaxReplicationSlots),
		MaxWalSenders:        intOrZero(self.MaxWalSenders),
		MaxSlotWalKeepSizeMB: intOrZero(self.MaxSlotWalKeepSizeMB),
	}
	if self.StorageSize != "" {
		qty, err := utils.ParseStorageQuantity(self.StorageSize)
		if err != nil {
			return nil, fmt.Errorf("invalid database storage size %q: %w", self.StorageSize, err)
		}
		dbConfig.StorageSize = &qty
	}
	return dbConfig, nil
}

func intOrZero(value *int) int {
	if value == nil {
		return 0
	}
	return *value
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
