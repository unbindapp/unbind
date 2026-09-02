package k8s

import (
	"context"
	"net/http"
	"time"

	certmanagerclientset "github.com/cert-manager/cert-manager/pkg/client/clientset/versioned"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// TokenVerifier validates an access token and returns its OIDC claims
type TokenVerifier interface {
	Verify(token string) (*auth.VerifiedClaims, error)
}

// KubeClient handles Kubernetes operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i KubeClientInterface -p k8s -s KubeClient -o kubeclient_iface.go
type KubeClient struct {
	config                    config.ConfigInterface
	baseConfig                *rest.Config
	tokenVerifier             TokenVerifier
	client                    dynamic.Interface
	clientset                 kubernetes.Interface
	applier                   *Applier
	updateJobPollInterval     time.Duration
	resizeCleanupPollInterval time.Duration
	longhornBackendURL        string
	certmanagerclient         *certmanagerclientset.Clientset
	dnsChecker                *utils.DNSChecker
	httpClient                *http.Client
	repo                      repositories.RepositoriesInterface
}

func NewKubeClient(cfg config.ConfigInterface, repo repositories.RepositoriesInterface) *KubeClient {
	var kubeConfig *rest.Config
	var err error

	if cfg.GetKubeConfig() != "" {
		// Use provided kubeconfig if present
		kubeConfig, err = clientcmd.BuildConfigFromFlags("", cfg.GetKubeConfig())
		if err != nil {
			log.Fatalf("Error building kubeconfig: %v", err)
		}
	} else {
		// Fall back to in-cluster config
		kubeConfig, err = rest.InClusterConfig()
		if err != nil {
			log.Fatalf("Error getting in-cluster config: %v", err)
		}
	}

	dynamicClient, err := dynamic.NewForConfig(kubeConfig)
	if err != nil {
		log.Fatalf("Error creating clientset: %v", err)
	}

	clientSet, err := kubernetes.NewForConfig(kubeConfig)
	if err != nil {
		log.Fatalf("Error creating clientset: %v", err)
	}

	certManagerClientSet, err := certmanagerclientset.NewForConfig(kubeConfig)
	if err != nil {
		log.Errorf("Error creating cert-manager clientset: %v", err)
	}

	return &KubeClient{
		config:                    cfg,
		baseConfig:                kubeConfig,
		client:                    dynamicClient,
		clientset:                 clientSet,
		applier:                   NewApplier(dynamicClient, clientSet.Discovery(), cfg.GetSystemNamespace()),
		updateJobPollInterval:     3 * time.Second,
		resizeCleanupPollInterval: 10 * time.Second,
		longhornBackendURL:        longhornBackendURL,
		certmanagerclient:         certManagerClientSet,
		dnsChecker:                utils.NewDNSChecker(),
		httpClient: &http.Client{
			Timeout: 1 * time.Second,
		},
		repo: repo,
	}
}

// This function is used to manage unbind-system resources
func (self *KubeClient) GetInternalClient() kubernetes.Interface {
	return self.clientset
}

// SetTokenVerifier wires the token verifier used to authorize per-user operations.
// It is set after construction because the token manager is built later.
func (self *KubeClient) SetTokenVerifier(verifier TokenVerifier) {
	self.tokenVerifier = verifier
}

// ApplyYAML applies a multi-document YAML bundle with server-side apply, dry-run first
func (self *KubeClient) ApplyYAML(ctx context.Context, yaml []byte) error {
	return self.applier.Apply(ctx, yaml)
}
