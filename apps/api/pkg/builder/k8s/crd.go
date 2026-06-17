package k8s

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	// Import the operator API package
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// ServiceParams contains all parameters needed to create a v1.Service object
type ServiceParams struct {
	// Basic service information
	Name        string
	DisplayName string
	Description string
	Namespace   string

	// Service type configuration
	Type             schema.ServiceType
	Builder          schema.ServiceBuilder
	Provider         string
	Framework        string
	DeploymentRef    string
	ServiceRef       string
	TeamRef          string
	ProjectRef       string
	EnvironmentRef   string
	KubernetesSecret string
	EnvVars          []corev1.EnvVar

	// Git configuration
	GitRepoURL           string
	GitRef               string
	GithubInstallationID *int64

	// Deployment configuration
	Image            string
	Hosts            []v1.HostSpec
	Ports            []v1.PortSpec
	Public           *bool
	Replicas         *int32
	ImagePullSecrets []string
	RunCommand       string

	// Volume
	Volumes []v1.VolumeSpec

	// Database
	DatabaseType          string
	DatabaseUSDVersionRef string
	DatabaseConfig        *v1.DatabaseConfigSpec
	BackupConfig          *v1.S3ConfigSpec

	// Security
	SecurityContext *corev1.SecurityContext

	// Health check
	HealthCheck *v1.HealthCheckSpec

	// Variable mounts
	VariableMounts []v1.VariableMountSpec

	// Init containers
	InitContainers []v1.InitContainerSpec

	// Resources
	Resources *v1.ResourceSpec
}

// CreateServiceObject creates a new v1.Service object with the provided parameters
func CreateServiceObject(params ServiceParams) (*v1.Service, error) {
	// Extract GitHub repository name from the Git URL
	gitRepository := extractGitRepository(params.GitRepoURL)

	// Generate a sanitized service name if not provided
	serviceName := params.Name
	if serviceName == "" {
		return nil, fmt.Errorf("service name cannot be empty")
	}

	// Create a new Service CR using the official structs
	service := &v1.Service{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "unbind.unbind.app/v1",
			Kind:       "Service",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      serviceName,
			Namespace: params.Namespace,
		},
		Spec: v1.ServiceSpec{
			Name:             serviceName,
			DisplayName:      params.DisplayName,
			Description:      params.Description,
			Type:             string(params.Type),
			Builder:          string(params.Builder),
			Provider:         params.Provider,
			Framework:        params.Framework,
			TeamRef:          params.TeamRef,
			ProjectRef:       params.ProjectRef,
			EnvironmentRef:   params.EnvironmentRef,
			ServiceRef:       params.ServiceRef,
			DeploymentRef:    params.DeploymentRef,
			KubernetesSecret: params.KubernetesSecret,
			GitRepository:    gitRepository,
			EnvVars:          params.EnvVars,
			ImagePullSecrets: params.ImagePullSecrets,
			SecurityContext:  params.SecurityContext,
		},
	}

	// Set GitHub installation ID if provided
	if params.GithubInstallationID != nil {
		service.Spec.GitHubInstallationID = params.GithubInstallationID
	}

	// Build service configuration
	service.Spec.Config = v1.ServiceConfigSpec{
		GitBranch:      params.GitRef,
		Image:          params.Image,
		HealthCheck:    params.HealthCheck,
		VariableMounts: params.VariableMounts,
		Volumes:        params.Volumes,
		InitContainers: params.InitContainers,
		Resources:      params.Resources,
	}

	if params.RunCommand != "" {
		service.Spec.Config.RunCommand = utils.ToPtr(params.RunCommand)
	}

	// Add host configuration if provided
	if len(params.Hosts) > 0 {
		service.Spec.Config.Hosts = params.Hosts
	}

	// Add port configuration if provided
	if len(params.Ports) > 0 {
		service.Spec.Config.Ports = params.Ports
	}

	// Set public flag if provided
	if params.Public != nil {
		service.Spec.Config.Public = *params.Public
	}

	// Set replicas if provided
	if params.Replicas != nil {
		replicas := int32(*params.Replicas)
		service.Spec.Config.Replicas = &replicas
	}

	// Set database configuration if provided
	if params.Type == schema.ServiceTypeDatabase {
		service.Spec.Config.Database = v1.DatabaseSpec{
			Type:                params.DatabaseType,
			DatabaseSpecVersion: params.DatabaseUSDVersionRef,
			Config:              params.DatabaseConfig,
			S3BackupConfig:      params.BackupConfig,
		}
	}

	return service, nil
}

// DeployImage creates (or replaces) the service resource in the target namespace
// for deployment after a successful build job.
func (self *K8SClient) DeployImage(ctx context.Context, crdName, image string, additionalEnv map[string]string, securityContext *corev1.SecurityContext, healthCheck *v1.HealthCheckSpec, variableMounts []v1.VariableMountSpec) (*unstructured.Unstructured, *v1.Service, error) {
	// Generate a sanitized service name from the repo name
	serviceName := strings.ToLower(strings.ReplaceAll(crdName, "_", "-"))

	var dbConfig *v1.DatabaseConfigSpec
	if self.builderConfig.ServiceDatabaseConfig != "" {
		// b64 decode first
		decodedConifg, err := base64.StdEncoding.DecodeString(self.builderConfig.ServiceDatabaseConfig)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to decode database template config: %v", err)
		}
		// Parse it to validate the format
		if err := json.Unmarshal([]byte(decodedConifg), &dbConfig); err != nil {
			return nil, nil, fmt.Errorf("failed to parse template config: %v", err)
		}
	}

	// Turn addtiionalEnv into corev1.EnvVar
	envVars := make([]corev1.EnvVar, len(additionalEnv))
	i := 0
	for k, v := range additionalEnv {
		envVars[i] = corev1.EnvVar{
			Name:  k,
			Value: v,
		}
		i++
	}

	// Unmarshal and b64 decode volumes
	var volumes []v1.VolumeSpec
	if self.builderConfig.ServiceVolumes != "" {
		decodedVolumes, err := base64.StdEncoding.DecodeString(self.builderConfig.ServiceVolumes)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to decode volumes: %v", err)
		}
		if err := json.Unmarshal([]byte(decodedVolumes), &volumes); err != nil {
			return nil, nil, fmt.Errorf("failed to parse volumes: %v", err)
		}
	}

	// Unmarshal and b64 decode init containers
	var initContainers []v1.InitContainerSpec
	if self.builderConfig.ServiceInitContainers != "" {
		decodedInitContainers, err := base64.StdEncoding.DecodeString(self.builderConfig.ServiceInitContainers)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to decode init containers: %v", err)
		}
		if err := json.Unmarshal([]byte(decodedInitContainers), &initContainers); err != nil {
			return nil, nil, fmt.Errorf("failed to parse init containers: %v", err)
		}
	}

	// Unmarshal and b64 decode resources
	var resources *v1.ResourceSpec
	if self.builderConfig.ServiceResources != "" {
		decodedResources, err := base64.StdEncoding.DecodeString(self.builderConfig.ServiceResources)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to decode resources: %v", err)
		}
		if err := json.Unmarshal([]byte(decodedResources), &resources); err != nil {
			return nil, nil, fmt.Errorf("failed to parse resources: %v", err)
		}
	}

	params := ServiceParams{
		Name:             serviceName,
		DisplayName:      serviceName,
		Description:      fmt.Sprintf("Auto-deployed service for %s", crdName),
		Namespace:        self.builderConfig.DeploymentNamespace,
		Type:             self.builderConfig.ServiceType,
		Builder:          self.builderConfig.ServiceBuilder,
		Provider:         self.builderConfig.ServiceProvider,
		Framework:        self.builderConfig.ServiceFramework,
		TeamRef:          self.builderConfig.ServiceTeamRef,
		ProjectRef:       self.builderConfig.ServiceProjectRef,
		EnvironmentRef:   self.builderConfig.ServiceEnvironmentRef,
		ServiceRef:       self.builderConfig.ServiceRef,
		DeploymentRef:    self.builderConfig.ServiceDeploymentID.String(),
		KubernetesSecret: self.builderConfig.ServiceSecretName,
		GitRepoURL:       self.builderConfig.GitRepoURL,
		GitRef:           self.builderConfig.GitRef,
		Image:            image,
		Hosts:            self.builderConfig.Hosts,
		Ports:            self.builderConfig.Ports,
		Public:           self.builderConfig.ServicePublic,
		Replicas:         self.builderConfig.ServiceReplicas,
		RunCommand:       self.builderConfig.ServiceRunCommand,
		EnvVars:          envVars,
		// Template
		DatabaseConfig:        dbConfig,
		DatabaseType:          self.builderConfig.ServiceDatabaseType,
		DatabaseUSDVersionRef: self.builderConfig.ServiceDatabaseDefinitionVersion,
		// ImagePullSecrets
		ImagePullSecrets: strings.Split(self.builderConfig.ImagePullSecrets, ","),
		// Volume
		Volumes: volumes,
		// Security context
		SecurityContext: securityContext,
		// Health check
		HealthCheck: healthCheck,
		// Variable mounts
		VariableMounts: variableMounts,
		// Init containers
		InitContainers: initContainers,
		// Resources
		Resources: resources,
	}

	if self.builderConfig.ServiceDatabaseBackupSecretName != "" &&
		self.builderConfig.ServiceDatabaseBackupBucket != "" &&
		self.builderConfig.ServiceDatabaseBackupRegion != "" &&
		self.builderConfig.ServiceDatabaseBackupEndpoint != "" {
		params.BackupConfig = &v1.S3ConfigSpec{
			SecretName:           self.builderConfig.ServiceDatabaseBackupSecretName,
			Bucket:               self.builderConfig.ServiceDatabaseBackupBucket,
			Region:               self.builderConfig.ServiceDatabaseBackupRegion,
			Endpoint:             self.builderConfig.ServiceDatabaseBackupEndpoint,
			BackupSchedule:       self.builderConfig.ServiceDatabaseBackupSchedule,
			BackupRetentionCount: self.builderConfig.ServiceDatabaseBackupRetention,
		}
	}

	// Set GitHub installation ID if provided
	if self.builderConfig.GithubInstallationID != 0 {
		installationID := self.builderConfig.GithubInstallationID
		params.GithubInstallationID = &installationID
	}

	// Create the Service object
	service, err := CreateServiceObject(params)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create service object: %v", err)
	}

	return self.k8s.DeployUnbindService(ctx, service)
}

// extractGitRepository parses a Git URL and extracts the repository information in the format "owner/repo"
func extractGitRepository(gitRepoURL string) string {
	parts := strings.Split(gitRepoURL, "/")
	if len(parts) < 2 {
		return ""
	}

	repoWithGit := parts[len(parts)-1]
	repo := strings.TrimSuffix(repoWithGit, ".git")

	if len(parts) >= 3 {
		owner := parts[len(parts)-2]
		return owner + "/" + repo
	}

	return repo
}
