package k8s

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	certmanagerclientset "github.com/cert-manager/cert-manager/pkg/client/clientset/versioned"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	yamlv3 "gopkg.in/yaml.v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// KubeClient handles Kubernetes operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i KubeClientInterface -p k8s -s KubeClient -o kubeclient_iface.go
type KubeClient struct {
	config            config.ConfigInterface
	client            dynamic.Interface
	clientset         kubernetes.Interface
	certmanagerclient *certmanagerclientset.Clientset
	dnsChecker        *utils.DNSChecker
	httpClient        *http.Client
	repo              repositories.RepositoriesInterface
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
		config:            cfg,
		client:            dynamicClient,
		clientset:         clientSet,
		certmanagerclient: certManagerClientSet,
		dnsChecker:        utils.NewDNSChecker(),
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

func (self *KubeClient) CreateClientWithToken(token string) (kubernetes.Interface, error) {
	config := &rest.Config{
		Host:        self.config.GetKubeProxyURL(),
		BearerToken: token,
		// Skip TLS verification for internal cluster communication
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true,
		},
	}

	return kubernetes.NewForConfig(config)
}

// ApplyYAML applies a YAML document to the cluster
func (self *KubeClient) ApplyYAML(ctx context.Context, yaml []byte) error {
	// Split YAML documents
	docs := strings.Split(string(yaml), "---")
	for _, doc := range docs {
		doc = strings.TrimSpace(doc)
		if doc == "" {
			continue
		}

		// Decode the YAML into an unstructured object
		obj := &unstructured.Unstructured{}
		if err := yamlv3.Unmarshal([]byte(doc), &obj.Object); err != nil {
			return fmt.Errorf("failed to decode YAML: %w", err)
		}

		// Get the GVR for the resource
		gvk := obj.GetObjectKind().GroupVersionKind()
		gvr := schema.GroupVersionResource{
			Group:    gvk.Group,
			Version:  gvk.Version,
			Resource: strings.ToLower(gvk.Kind) + "s", // Convert Kind to plural form
		}

		// Get the dynamic client for the resource
		dynamicClient := self.client.Resource(gvr)

		// Get the namespace
		namespace := obj.GetNamespace()
		if namespace == "" {
			namespace = self.config.GetSystemNamespace()
		}

		// Try to create the resource
		_, err := dynamicClient.Namespace(namespace).Create(ctx, obj, metav1.CreateOptions{})
		if err != nil {
			// If the resource already exists, update it
			if apierrors.IsAlreadyExists(err) {
				_, err = dynamicClient.Namespace(namespace).Update(ctx, obj, metav1.UpdateOptions{})
				if err != nil {
					return fmt.Errorf("failed to update resource: %w", err)
				}
			} else {
				return fmt.Errorf("failed to create resource: %w", err)
			}
		}
	}

	return nil
}
