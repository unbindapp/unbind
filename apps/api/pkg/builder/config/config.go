package config

import (
	"encoding/json"
	"fmt"

	"github.com/caarlos0/env/v11"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
)

type Config struct {
	ExternalUIUrl string `env:"EXTERNAL_UI_URL" envDefault:"http://localhost:3000"`
	GithubAppID   int64  `env:"GITHUB_APP_ID"`
	// Installation ID of the app
	GithubInstallationID int64 `env:"GITHUB_INSTALLATION_ID"`
	// Repository to clone (github, https)
	GitRepoURL string `env:"GITHUB_REPO_URL"`
	// Branch to checkout and build
	GitRef string `env:"GIT_REF"`
	// Github URL (if using github enterprise)
	GithubURL string `env:"GITHUB_URL" envDefault:"https://github.com"`
	// Github app private key
	GithubAppPrivateKey string `env:"GITHUB_APP_PRIVATE_KEY"`
	// Registry specific
	ContainerRegistryHost     string `env:"CONTAINER_REGISTRY_HOST,required"`
	ContainerRegistryUser     string `env:"CONTAINER_REGISTRY_USER"`
	ContainerRegistryPassword string `env:"CONTAINER_REGISTRY_PASSWORD"`
	// Database access
	PostgresHost     string `env:"POSTGRES_HOST" envDefault:"localhost"`
	PostgresPort     int    `env:"POSTGRES_PORT" envDefault:"5432"`
	PostgresUser     string `env:"POSTGRES_USER" envDefault:"postgres"`
	PostgresPassword string `env:"POSTGRES_PASSWORD" envDefault:"postgres"`
	PostgresDB       string `env:"POSTGRES_DB" envDefault:"unbind"`
	PostgresSSLMode  string `env:"POSTGRES_SSL_MODE" envDefault:"disable"`
	// Buildkitd host
	BuildkitHost string `env:"BUILDKIT_HOST" envDefault:"tcp://buildkitd.unbind-system:1234"`
	// Deployment namespace (kubernetes)
	DeploymentNamespace string `env:"DEPLOYMENT_NAMESPACE,required"`
	// Service specific
	ServiceDeploymentID                uuid.UUID             `env:"SERVICE_DEPLOYMENT_ID"`
	ServiceName                        string                `env:"SERVICE_NAME"`
	ServiceProvider                    string                `env:"SERVICE_PROVIDER"`
	ServiceFramework                   string                `env:"SERVICE_FRAMEWORK"`
	ServicePublic                      *bool                 `env:"SERVICE_PUBLIC"`
	ServiceReplicas                    *int32                `env:"SERVICE_REPLICAS"`
	ServiceSecretName                  string                `env:"SERVICE_SECRET_NAME,required"`
	ServiceBuildSecrets                string                `env:"SERVICE_BUILD_SECRETS"`
	ServiceType                        schema.ServiceType    `env:"SERVICE_TYPE"`
	ServiceBuilder                     schema.ServiceBuilder `env:"SERVICE_BUILDER"`
	ServiceTeamRef                     string                `env:"SERVICE_TEAM_REF"`
	ServiceProjectRef                  string                `env:"SERVICE_PROJECT_REF"`
	ServiceEnvironmentRef              string                `env:"SERVICE_ENVIRONMENT_REF"`
	ServiceRef                         string                `env:"SERVICE_REF"`
	ServiceDockerBuilderDockerfilePath string                `env:"SERVICE_DOCKER_BUILDER_DOCKERFILE_PATH"` // Path to Dockerfile in the repo (optional)
	ServiceDockerBuilderBuildContext   string                `env:"SERVICE_DOCKER_BUILDER_BUILD_CONTEXT"`   // Path to Dockerfile context in the repo (optional)
	ServiceImage                       string                `env:"SERVICE_IMAGE"`                          // Custom image if not building from git
	ServiceRunCommand                  string                `env:"SERVICE_RUN_COMMAND"`                    // Command to run the service
	// Database data
	ServiceDatabaseType              string `env:"SERVICE_DATABASE_TYPE"`
	ServiceDatabaseDefinitionVersion string `env:"SERVICE_DATABASE_USD_VERSION"`
	ServiceDatabaseConfig            string `env:"SERVICE_DATABASE_CONFIG"`
	ServiceDatabaseBackupBucket      string `env:"SERVICE_DATABASE_BACKUP_BUCKET"`
	ServiceDatabaseBackupRegion      string `env:"SERVICE_DATABASE_BACKUP_REGION"`
	ServiceDatabaseBackupEndpoint    string `env:"SERVICE_DATABASE_BACKUP_ENDPOINT"`
	ServiceDatabaseBackupSecretName  string `env:"SERVICE_DATABASE_BACKUP_SECRET_NAME"`
	ServiceDatabaseBackupSchedule    string `env:"SERVICE_DATABASE_BACKUP_SCHEDULE"`
	ServiceDatabaseBackupRetention   int    `env:"SERVICE_DATABASE_BACKUP_RETENTION"`
	ServiceHealthCheck               string `env:"SERVICE_HEALTH_CHECK"`
	// Volume data
	ServiceVolumes        string `env:"SERVICE_VOLUMES"`         // Json serialized schema.ServiceVolume
	ServiceVariableMounts string `env:"SERVICE_VARIABLE_MOUNTS"` // Json serialized map[string]string
	// Init containers
	ServiceInitContainers string `env:"SERVICE_INIT_CONTAINERS"`
	// B64 encoded resources
	ServiceResources string `env:"SERVICE_RESOURCES"`
	// Json serialized []HostSpec
	ServiceHosts string `env:"SERVICE_HOSTS"`
	// JsonSerialized []PortSpec
	ServicePorts string `env:"SERVICE_PORTS"`
	// Pull image secrets to pass to operator
	ImagePullSecrets string `env:"IMAGE_PULL_SECRETS"`
	// Railpack specific
	RailpackInstallCommand string `env:"RAILPACK_INSTALL_CMD"`
	RailpackBuildCommand   string `env:"RAILPACK_BUILD_CMD"`
	// Kubeconfig for local testing
	KubeConfig string `env:"KUBECONFIG"`
	// Non-env config
	Hosts []v1.HostSpec
	Ports []v1.PortSpec
	// Json serialized map[string]string to pass to build and deploy
	AdditionalEnv string `env:"ADDITIONAL_ENV"`
	// Checking out specific commit
	CheckoutCommitSHA string `env:"CHECKOUT_COMMIT_SHA"`
	// Security context
	SecurityContext string `env:"SECURITY_CONTEXT"`
	// Disable buildkit cache
	DisableBuildCache bool `env:"DISABLE_BUILD_CACHE" envDefault:"false"`
}

func (self *Config) GetPostgresHost() string {
	return self.PostgresHost
}

func (self *Config) GetPostgresPort() int {
	return self.PostgresPort
}

func (self *Config) GetPostgresUser() string {
	return self.PostgresUser
}

func (self *Config) GetPostgresPassword() string {
	return self.PostgresPassword
}

func (self *Config) GetPostgresDB() string {
	return self.PostgresDB
}

func (self *Config) GetPostgresSSLMode() string {
	return self.PostgresSSLMode
}

func (self *Config) GetKubeConfig() string {
	return self.KubeConfig
}

func (self *Config) GetBuildImage() string {
	return ""
}

func (self *Config) GetSystemNamespace() string {
	return ""
}

func (self *Config) GetKubeProxyURL() string {
	return ""
}

func (self *Config) GetBuildkitHost() string {
	return self.BuildkitHost
}

// Parse environment variables into a Config struct
func NewConfig() *Config {
	cfg := Config{}
	if err := env.Parse(&cfg); err != nil {
		log.Fatal("Error parsing environment", "err", err)
	}
	cfg.Hosts, _ = parseHosts(&cfg)
	cfg.Ports, _ = parsePorts(&cfg)
	return &cfg
}

// parseHosts parses host configuration from environment variables
func parseHosts(cfg *Config) ([]v1.HostSpec, error) {
	hosts := []v1.HostSpec{}

	if cfg.ServiceHosts != "" {
		var jsonHosts []v1.HostSpec
		if err := json.Unmarshal([]byte(cfg.ServiceHosts), &jsonHosts); err != nil {
			return nil, fmt.Errorf("failed to parse hosts: %w", err)
		}
		for i := range jsonHosts {
			if jsonHosts[i].Path == "" {
				jsonHosts[i].Path = "/"
			}
		}
		// If we already had legacy hosts, append the new ones
		hosts = append(hosts, jsonHosts...)
	}

	return hosts, nil
}

// parsePorts parses port configuration from environment variables
func parsePorts(cfg *Config) ([]v1.PortSpec, error) {
	ports := []v1.PortSpec{}

	if cfg.ServicePorts != "" {
		var jsonPorts []v1.PortSpec
		if err := json.Unmarshal([]byte(cfg.ServicePorts), &jsonPorts); err != nil {
			return nil, fmt.Errorf("failed to parse ports: %w", err)
		}
		for i := range jsonPorts {
			// Set default protocol if not specified
			if jsonPorts[i].Protocol == nil {
				tcpProtocol := corev1.ProtocolTCP
				jsonPorts[i].Protocol = &tcpProtocol
			}
		}
		// Append to existing ports
		ports = append(ports, jsonPorts...)
	}

	return ports, nil
}
