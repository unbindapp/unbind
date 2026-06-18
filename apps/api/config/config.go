package config

import (
	"net/url"
	"path"
	"strings"

	"github.com/caarlos0/env/v11"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

type ConfigInterface interface {
	GetPostgresHost() string
	GetPostgresPort() int
	GetPostgresUser() string
	GetPostgresPassword() string
	GetPostgresDB() string
	GetPostgresSSLMode() string
	GetKubeConfig() string
	GetSystemNamespace() string
	GetBuildkitHost() string
	GetBuildImage() string
}

type Config struct {
	SystemNamespace string `env:"SYSTEM_NAMESPACE,required"`
	// Root
	ExternalUIUrl  string `env:"EXTERNAL_UI_URL" envDefault:"http://localhost:3000"`
	ExternalAPIURL string `env:"EXTERNAL_API_URL" envDefault:"http://localhost:8089"`
	// This is for generating subdomains
	BootstrapWildcardBaseURL string `env:"BOOTSTRAP_WILDCARD_BASE_URL" envDefault:"http://localhost:8089"`
	ExternalOauth2URL        string `env:"EXTERNAL_OAUTH2_URL" envDefault:"http://localhost:8090"`
	// Records which embedded service-definition set shipped with this build.
	// Definitions are no longer fetched per tag; this is informational only.
	UnbindServiceDefVersion string `env:"UNBIND_SERVICE_DEF_VERSION" envDefault:"embedded"`
	// Github Specific
	GithubURL        string `env:"GITHUB_URL" envDefault:"https://github.com"` // Override for github enterprise
	GithubWebhookURL string
	// By default we will just use the external URL for the bind and unbind suffixes
	UnbindSuffix string `env:"UNBIND_SUFFIX"`
	// Postgres
	PostgresHost     string `env:"POSTGRES_HOST" envDefault:"localhost"`
	PostgresPort     int    `env:"POSTGRES_PORT" envDefault:"5432"`
	PostgresUser     string `env:"POSTGRES_USER" envDefault:"postgres"`
	PostgresPassword string `env:"POSTGRES_PASSWORD" envDefault:"postgres"`
	PostgresDB       string `env:"POSTGRES_DB" envDefault:"unbind"`
	PostgresSSLMode  string `env:"POSTGRES_SSL_MODE" envDefault:"disable"`
	// Redis
	RedisURL string `env:"REDIS_URL" envDefault:"localhost:6379"`
	// Auth tokens. TokenAudience is the JWT "aud" claim minted into access tokens.
	TokenAudience string `env:"TOKEN_AUDIENCE" envDefault:"unbind-api"`
	// CookieSecure should be false only for local http development.
	CookieSecure bool `env:"COOKIE_SECURE" envDefault:"true"`
	// Kubernetes config, optional - if in cluster it will use the in-cluster config
	KubeConfig string `env:"KUBECONFIG"`
	// Registry specific
	BootstrapContainerRegistryHost     string `env:"BOOTSTRAP_CONTAINER_REGISTRY_HOST"`
	BootstrapContainerRegistryUser     string `env:"BOOTSTRAP_CONTAINER_REGISTRY_USER"`
	BootstrapContainerRegistryPassword string `env:"BOOTSTRAP_CONTAINER_REGISTRY_PASSWORD"`
	// Buildkit
	BuildkitHost string `env:"BUILDKIT_HOST" envDefault:"tcp://buildkitd.unbind-system:1234"`
	// Logging
	LokiEndpoint string `env:"LOKI_ENDPOINT" envDefault:"http://loki-unbind-gateway.unbind-system.svc.cluster.local"`
	// Metrics
	PrometheusEndpoint string `env:"PROMETHEUS_ENDPOINT" envDefault:"http://kube-prometheus-stack-prometheus.monitoring:9090"`
	// Dev origins will inject localhost:3000 into cors, etc.
	InjectDevOrigins bool `env:"INJECT_DEV_ORIGINS" envDefault:"false"`
	SkipBootstrap    bool `env:"SKIP_BOOTSTRAP" envDefault:"false"`
	// Builder to pass around
	BuildImage string
	// Override the release repository for testing
	ReleaseRepoOverride string `env:"RELEASE_REPO_OVERRIDE"`
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

func (self *Config) GetSystemNamespace() string {
	return self.SystemNamespace
}

func (self *Config) GetBuildkitHost() string {
	return self.BuildkitHost
}

func (self *Config) GetBuildImage() string {
	return self.BuildImage
}

// Parse environment variables into a Config struct
func NewConfig() *Config {
	cfg := Config{}
	if err := env.Parse(&cfg); err != nil {
		log.Fatal("Error parsing environment", "err", err)
	}

	// Get suffix if not present
	if cfg.UnbindSuffix == "" {
		suffix, err := utils.ValidateAndExtractDomain(cfg.ExternalAPIURL)
		if err != nil {
			log.Fatal("Error extracting domain from external URL", "err", err)
		}
		cfg.UnbindSuffix = strings.ToLower(suffix)
	}

	// Parse github callback URL
	baseURL, _ := url.Parse(cfg.ExternalAPIURL)
	baseURL.Path = path.Join(baseURL.Path, "webhook/github")
	cfg.GithubWebhookURL = baseURL.String()

	return &cfg
}
