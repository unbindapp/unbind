/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!
// NOTE: json tags are required.  Any new fields you add must have json tags for the fields to be serialized.

// ServiceSpec defines the desired state of the Service
type ServiceSpec struct {
	// Name of the service
	Name string `json:"name"`

	// DisplayName is a human-friendly name for the service
	DisplayName string `json:"displayName,omitempty"`

	// Description of the service
	Description string `json:"description,omitempty"`

	// Type of service - git or dockerfile or template
	Type string `json:"type"`

	// Builder to use - railpack or docker or template
	Builder string `json:"builder"`

	// Provider (e.g. Go, Python, Node, Deno)
	Provider string `json:"provider,omitempty"`

	// Framework used (e.g. Django, Next, Express, Gin)
	Framework string `json:"framework,omitempty"`

	// GitHubInstallationID for GitHub integration
	GitHubInstallationID *int64 `json:"githubInstallationId,omitempty"`

	// GitRepository name
	GitRepository string `json:"gitRepository,omitempty"`

	// KubernetesSecret name for this service
	KubernetesSecret string `json:"kubernetesSecret"`

	// Configuration for the service
	Config ServiceConfigSpec `json:"config"`

	// Additional environment variables to attach
	EnvVars []corev1.EnvVar `json:"envVars,omitempty"`

	// Registry secrets to pull images from
	ImagePullSecrets []string `json:"imagePullSecrets,omitempty"`

	// DeploymentRef is a reference to the deployment this service is based on
	DeploymentRef string `json:"deploymentRef,omitempty"`

	// ServiceRef is a reference to the service this service is based on
	ServiceRef string `json:"serviceRef,omitempty"`

	// TeamRef is a reference to the team that owns this service
	TeamRef string `json:"teamRef"`

	// ProjectRef is a reference to the project this service belongs to
	ProjectRef string `json:"projectRef"`

	// EnvironmentRef references the environment this service belongs to
	EnvironmentRef string `json:"environmentRef"`

	// SecurityContext defines the security context for the pod
	SecurityContext *corev1.SecurityContext `json:"securityContext,omitempty"`
}

// ServiceConfigSpec defines configuration for a service
type ServiceConfigSpec struct {
	// GitBranch to build from
	GitBranch string `json:"gitBranch,omitempty"`

	// Hosts is the external domain(s) and paths for the service
	Hosts []HostSpec `json:"hosts,omitempty"`

	// Ports are the container ports to expose
	Ports []PortSpec `json:"ports,omitempty"`

	// Replicas is the number of replicas for the service
	Replicas *int32 `json:"replicas,omitempty"`

	// RunCommand is a custom run command
	RunCommand *string `json:"runCommand,omitempty"`

	// Public indicates whether the service is publicly accessible
	Public bool `json:"public,omitempty"`

	// Image is a custom Docker image if not building from git
	Image string `json:"image"`

	// Databases are custom resources to create
	Database DatabaseSpec `json:"database"`

	// Volumes are mounted inside of the container at specified paths
	Volumes []VolumeSpec `json:"volumes,omitempty"`

	// HealthCheck defines a simplified health check that applies to all probe types
	HealthCheck *HealthCheckSpec `json:"healthCheck,omitempty"`

	// VariableMounts are paths to mount variables (from secret ref)
	VariableMounts []VariableMountSpec `json:"variableMounts,omitempty"`

	// InitContainers are the init containers to run before the main container
	InitContainers []InitContainerSpec `json:"initContainers,omitempty"`

	// Resources defines the resource requirements for the container
	Resources *ResourceSpec `json:"resources,omitempty"`
}

// ResourceSpec defines the resource requirements for a container
type ResourceSpec struct {
	// CPU requests and limits
	CPURequestsMillicores int64 `json:"cpuRequestsMillicores"`
	CPULimitsMillicores   int64 `json:"cpuLimitsMillicores"`
	// Memory requests and limits
	MemoryRequestsMegabytes int64 `json:"memoryRequestsMegabytes"`
	MemoryLimitsMegabytes   int64 `json:"memoryLimitsMegabytes"`
}

// Init container spec
type InitContainerSpec struct {
	Image   string `json:"image"`   // Init container image
	Command string `json:"command"` // Command to run in the init container
}

// Mounting secret as a file/
type VariableMountSpec struct {
	Name string `json:"name"` // Variable Name
	Path string `json:"path"` // Path to mount the variable
}

// ServiceStatus defines the observed state of Service
type ServiceStatus struct {
	// Conditions represent the latest available observations of an object's state
	Conditions []metav1.Condition `json:"conditions,omitempty"`

	// DeploymentStatus represents the status of the deployment
	DeploymentStatus string `json:"deploymentStatus,omitempty"`

	// URLs is the external URLs where the service is accessible
	URLs []string `json:"urls,omitempty"`

	// LastDeployedAt is the time when the service was last deployed
	LastDeployedAt *metav1.Time `json:"lastDeployedAt,omitempty"`
}

type HostSpec struct {
	// Host is the external domain for the service
	Host string `json:"host"`
	Path string `json:"path"`
	Port *int32 `json:"port,omitempty" required:"false"`
	// Protocol is the application protocol for domain routing: "http" (default) or "grpc".
	// +kubebuilder:validation:Enum=http;grpc
	Protocol string `json:"protocol,omitempty" required:"false"`
}

type VolumeSpec struct {
	Name      string `json:"name"`      // PVC name
	MountPath string `json:"mountPath"` // Path to mount the volume
}

type PortSpec struct {
	NodePort *int32 `json:"nodePort,omitempty" required:"false"` // NodePort will create a NodePort service
	// Port is the container port to expose
	Port     int32            `json:"port"`
	Protocol *corev1.Protocol `json:"protocol,omitempty" required:"false"`
}

type DatabaseSpec struct {
	// Type of the database
	Type string `json:"type"`
	// DatabaseSpecVersion is a reference to the version of the database spec
	DatabaseSpecVersion string              `json:"databaseSpecVersion"`
	Config              *DatabaseConfigSpec `json:"config,omitempty"`
	// S3Config for backupps
	S3BackupConfig *S3ConfigSpec `json:"s3BackupConfig,omitempty"`
	// ! TODO - restore options
}

type DatabaseConfigSpec struct {
	Version             string `json:"version,omitempty"`
	StorageSize         string `json:"storage,omitempty"`
	DefaultDatabaseName string `json:"defaultDatabaseName,omitempty"`
	InitDB              string `json:"initdb,omitempty"`
	WalLevel            string `json:"walLevel,omitempty"`
}

func (self *DatabaseConfigSpec) AsMap() map[string]any {
	res := make(map[string]any)
	if self.Version != "" {
		res["version"] = self.Version
	}
	if self.StorageSize != "" {
		res["storage"] = self.StorageSize
	}
	if self.DefaultDatabaseName != "" {
		res["defaultDatabaseName"] = self.DefaultDatabaseName
	}
	if self.InitDB != "" {
		res["initdb"] = self.InitDB
	}
	if self.WalLevel != "" {
		res["walLevel"] = self.WalLevel
	}
	return res
}

type S3ConfigSpec struct {
	Bucket   string `json:"bucket"`
	Endpoint string `json:"endpoint"`
	Region   string `json:"region"`
	// secret name containing the credentials
	SecretName           string `json:"secretName"`
	BackupSchedule       string `json:"backupSchedule"`
	BackupRetentionCount int    `json:"backupRetentionCount"`
}

// HealthCheckSpec defines a unified health check that will be translated to all probes
type HealthCheckSpec struct {
	// Type of health check, either "http" or "exec"
	// +kubebuilder:validation:Enum=http;exec
	Type string `json:"type"`

	// Path for HTTP health checks (e.g., "/api/health")
	Path string `json:"path,omitempty"`

	// Port for HTTP health checks (defaults to first container port if not specified)
	Port *int32 `json:"port,omitempty"`

	// Command for exec health checks (will be parsed similar to RunCommand)
	Command string `json:"command,omitempty"`

	// StartupPeriodSeconds is how often to perform the probe (default: 3)
	StartupPeriodSeconds *int32 `json:"startupPeriodSeconds,omitempty"`

	// StartupTimeoutSeconds is how long to wait before marking probe as failed (default: 5)
	StartupTimeoutSeconds *int32 `json:"startupTimeoutSeconds,omitempty"`

	// StartupFailureThreshold is the failure threshold for startup probes (default: 30)
	StartupFailureThreshold *int32 `json:"startupFailureThreshold,omitempty"`

	// HealthPeriodSeconds is how often to perform the probe (default: 10)
	HealthPeriodSeconds *int32 `json:"healthPeriodSeconds,omitempty"`

	// HealthTimeoutSeconds is how long to wait before marking probe as failed (default: 5)
	HealthTimeoutSeconds *int32 `json:"healthTimeoutSeconds,omitempty"`

	// HealthFailureThreshold is the failure threshold for health probes (default: 3)
	HealthFailureThreshold *int32 `json:"healthFailureThreshold,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Project",type=string,JSONPath=`.spec.projectRef`
// +kubebuilder:printcolumn:name="Environment",type=string,JSONPath=`.spec.environmentRef`
// +kubebuilder:printcolumn:name="Type",type=string,JSONPath=`.spec.type`
// +kubebuilder:printcolumn:name="Status",type=string,JSONPath=`.status.deploymentStatus`
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`

// Service is the Schema for the services API.
type Service struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ServiceSpec   `json:"spec,omitempty"`
	Status ServiceStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// ServiceList contains a list of Service.
type ServiceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []Service `json:"items"`
}

func init() {
	SchemeBuilder.Register(&Service{}, &ServiceList{})
}
