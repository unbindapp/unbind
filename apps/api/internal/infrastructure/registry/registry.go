package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// RegistryTester provides methods to check if an image can be pulled from configured registries and to test registry credentials
type RegistryTester struct {
	cfg        *config.Config
	repo       repositories.RepositoriesInterface
	kubeClient k8s.KubeClientInterface
	httpClient *http.Client
}

// NewRegistryTester creates a new RegistryTester instance (renamed from NewImageChecker)
func NewRegistryTester(cfg *config.Config, repo repositories.RepositoriesInterface, kubeClient k8s.KubeClientInterface) *RegistryTester {
	return &RegistryTester{
		cfg:        cfg,
		repo:       repo,
		kubeClient: kubeClient,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ParseImageString parses an image string and returns registry, image name, and tag
func ParseImageString(image string) (registry, imageName, tag string) {
	// Default to docker.io if no registry specified
	registry = "docker.io"

	// Split on the last colon to separate tag
	parts := strings.Split(image, ":")
	imageTag := ""
	fullImage := image

	if len(parts) > 1 {
		imageTag = parts[len(parts)-1]
		fullImage = strings.Join(parts[:len(parts)-1], ":")
	}

	// Check if registry is specified
	// If we have a slash and a dot or colon before the first slash, it's a registry
	firstSlash := strings.Index(fullImage, "/")
	if firstSlash > 0 {
		possibleRegistry := fullImage[:firstSlash]
		if strings.Contains(possibleRegistry, ".") || strings.Contains(possibleRegistry, ":") {
			registry = possibleRegistry
			imageName = fullImage[firstSlash+1:]
		} else {
			// No registry specified, use default
			imageName = fullImage
		}
	} else {
		imageName = fullImage
	}

	// Handle Docker Hub special case - add library if needed
	if registry == "docker.io" && !strings.Contains(imageName, "/") {
		imageName = "library/" + imageName
	}

	if imageTag == "" {
		tag = "latest"
	} else {
		tag = imageTag
	}

	return registry, imageName, tag
}

// CanPullImage checks if the given image can be pulled using any of the configured registries
func (self *RegistryTester) CanPullImage(ctx context.Context, image string) (bool, error) {
	// Parse the image string
	registryHost, imageName, tag := ParseImageString(image)

	// First, try without credentials (public image)
	exists, err := self.checkImageExistsInRegistry(ctx, registryHost, imageName, tag, "", "")
	if err == nil && exists {
		return true, nil
	}

	// If public check failed, try with credentials from our registry table
	registries, err := self.repo.System().GetAllRegistries(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to query registries: %w", err)
	}

	// Find matching registry and try with its credentials
	for _, registry := range registries {
		if registry.Host == registryHost {
			secret, err := self.kubeClient.GetSecret(ctx, registry.KubernetesSecret, self.cfg.SystemNamespace, self.kubeClient.GetInternalClient())
			if err != nil {
				continue // Skip if can't get secret
			}

			// Parse credentials
			username, password, err := self.kubeClient.ParseRegistryCredentials(secret)
			if err != nil {
				continue // Skip if can't parse credentials
			}

			// Check if image exists with credentials
			exists, err := self.checkImageExistsInRegistry(ctx, registry.Host, imageName, tag, username, password)
			if err == nil && exists {
				return true, nil
			}
		}
	}

	// If no registry matched, check if the image is public
	exists, err = self.checkImageExistsInRegistry(ctx, registryHost, imageName, tag, "", "")
	if err == nil && exists {
		return true, nil
	}

	return false, nil
}

// checkImageExistsInRegistry checks if an image exists in a specific registry using the registry API
func (self *RegistryTester) checkImageExistsInRegistry(ctx context.Context, registryHost, imageName, tag, username, password string) (bool, error) {
	// Normalize Docker Hub registry URL
	var registryURL string
	if registryHost == "docker.io" {
		registryURL = "https://index.docker.io/v2"
	} else if !strings.HasPrefix(registryHost, "http") {
		// Assume HTTPS for private registries if protocol not specified
		registryURL = "https://" + registryHost + "/v2"
	} else {
		registryURL = registryHost + "/v2"
	}

	// First, get a token if this is Docker Hub
	if registryHost == "docker.io" {
		token, err := self.getDockerHubToken(ctx, imageName, username, password)
		if err != nil {
			return false, nil
		}

		// Check manifest using token
		return self.checkManifestWithToken(ctx, registryURL, imageName, tag, token)
	}

	// For private registries, use basic auth if credentials are provided
	return self.checkManifestWithBasicAuth(ctx, registryURL, imageName, tag, username, password)
}

// getDockerHubToken obtains a token for Docker Hub
func (self *RegistryTester) getDockerHubToken(ctx context.Context, imageName, username, password string) (string, error) {
	url := fmt.Sprintf("https://auth.docker.io/token?service=registry.docker.io&scope=repository:%s:pull", imageName)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}

	// Add basic auth if we have credentials
	if username != "" && password != "" {
		req.SetBasicAuth(username, password)
	}

	resp, err := self.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get token: %s", resp.Status)
	}

	var tokenResponse struct {
		Token string `json:"token"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		return "", err
	}

	return tokenResponse.Token, nil
}

// checkManifestWithToken checks if an image manifest exists using a bearer token
func (self *RegistryTester) checkManifestWithToken(ctx context.Context, registryURL, imageName, tag, token string) (bool, error) {
	url := fmt.Sprintf("%s/%s/manifests/%s", registryURL, imageName, tag)

	req, err := http.NewRequestWithContext(ctx, "HEAD", url, nil)
	if err != nil {
		return false, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.docker.distribution.manifest.v2+json")

	resp, err := self.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	// Image exists if we get 200 OK
	return resp.StatusCode == http.StatusOK, nil
}

// checkManifestWithBasicAuth checks if an image manifest exists using basic auth
func (self *RegistryTester) checkManifestWithBasicAuth(ctx context.Context, registryURL, imageName, tag, username, password string) (bool, error) {
	url := fmt.Sprintf("%s/%s/manifests/%s", registryURL, imageName, tag)

	req, err := http.NewRequestWithContext(ctx, "HEAD", url, nil)
	if err != nil {
		return false, err
	}

	if username != "" && password != "" {
		req.SetBasicAuth(username, password)
	}
	req.Header.Set("Accept", "application/vnd.docker.distribution.manifest.v2+json")

	resp, err := self.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	// Image exists if we get 200 OK
	return resp.StatusCode == http.StatusOK, nil
}

// TestRegistryCredentials tests if the provided credentials are valid for a given registry (docker.io, ghcr, quay, or arbitrary URL)
func (self *RegistryTester) TestRegistryCredentials(ctx context.Context, registryHost, username, password string) (bool, error) {
	// We'll try to access a known endpoint that requires authentication
	// For Docker Hub, GHCR, Quay, and generic registries, we'll attempt to list repositories or get a token

	var testImage, testTag string
	// Use a common public image for test, e.g. "library/busybox" for docker.io
	switch {
	case registryHost == "docker.io":
		testImage = "library/busybox"
		testTag = "latest"
		// Try to get a token with credentials
		token, err := self.getDockerHubToken(ctx, testImage, username, password)
		if err != nil || token == "" {
			return false, nil
		}
		// Try to access manifest with token
		ok, err := self.checkManifestWithToken(ctx, "https://index.docker.io/v2", testImage, testTag, token)
		return ok, err
	case strings.Contains(registryHost, "ghcr.io"):
		testImage = "github/super-linter"
		testTag = "latest"
		registryURL := "https://ghcr.io/v2"
		return self.checkManifestWithBasicAuth(ctx, registryURL, testImage, testTag, username, password)
	case strings.Contains(registryHost, "quay.io"):
		testImage = "quay/busybox"
		testTag = "latest"
		registryURL := "https://quay.io/v2"
		return self.checkManifestWithBasicAuth(ctx, registryURL, testImage, testTag, username, password)
	default:
		// For arbitrary registries, try to access a manifest for a common image
		var registryURL string
		if !strings.HasPrefix(registryHost, "http") {
			registryURL = "https://" + registryHost + "/v2"
		} else {
			registryURL = registryHost + "/v2"
		}
		testImage = "busybox"
		testTag = "latest"
		return self.checkManifestWithBasicAuth(ctx, registryURL, testImage, testTag, username, password)
	}
}
