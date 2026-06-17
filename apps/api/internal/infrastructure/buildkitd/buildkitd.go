package buildkitd

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

const (
	// ConfigMap details
	BuildkitDeploymentName = "buildkitd"
	BuildkitConfigName     = "buildkit-config"
	BuildkitConfigKey      = "buildkitd.toml"

	// Default buildkitd.toml content
	DefaultBuildkitConfig = `[worker.oci]
# Limit concurrency of build steps:
max-parallelism = 2
[registry."docker-registry.%s:5000"]
http = true
insecure = true
[frontend."dockerfile.v0"]
enabled = true
`
)

type BuildkitSettingsManager struct {
	cfg  *config.Config
	Repo repositories.RepositoriesInterface
	k8s  *k8s.KubeClient
}

func NewBuildkitSettingsManager(cfg *config.Config, repo repositories.RepositoriesInterface, k8sClient *k8s.KubeClient) *BuildkitSettingsManager {
	return &BuildkitSettingsManager{
		cfg:  cfg,
		Repo: repo,
		k8s:  k8sClient,
	}
}

// GetOrCreateBuildkitConfig retrieves the existing buildkit ConfigMap, returns NotFound if it does not exist
func (self *BuildkitSettingsManager) GetBuildkitConfig(ctx context.Context) (*corev1.ConfigMap, error) {
	// Try to get the existing ConfigMap
	cm, err := self.k8s.GetInternalClient().CoreV1().ConfigMaps(self.cfg.SystemNamespace).Get(ctx, BuildkitConfigName, metav1.GetOptions{})

	if err != nil {
		if !errors.IsNotFound(err) {
			log.Errorf("failed to get buildkit ConfigMap: %v", err)
		}
		return nil, err
	}

	// ConfigMap exists, return it
	return cm, nil
}

// UpdateMaxParallelism updates the max-parallelism setting in the buildkitd.toml
func (self *BuildkitSettingsManager) UpdateMaxParallelism(ctx context.Context, parallelism int) error {
	cm, err := self.GetBuildkitConfig(ctx)
	if err != nil {
		return err
	}

	// Get the current buildkitd.toml content
	tomlContent, exists := cm.Data[BuildkitConfigKey]
	if !exists {
		// If the key doesn't exist, use the default config
		tomlContent = fmt.Sprintf(DefaultBuildkitConfig, self.cfg.SystemNamespace)
	}

	// Update the max-parallelism value using regex
	re := regexp.MustCompile(`(max-parallelism = )(\d+)`)
	newTomlContent := re.ReplaceAllString(tomlContent, fmt.Sprintf("${1}%d", parallelism))

	// Check if the pattern was found and replaced
	if tomlContent == newTomlContent && !strings.Contains(tomlContent, "max-parallelism") {
		return fmt.Errorf("max-parallelism setting not found in buildkitd.toml")
	}

	// Update the ConfigMap
	cm.Data[BuildkitConfigKey] = newTomlContent
	_, err = self.k8s.GetInternalClient().CoreV1().ConfigMaps(self.cfg.SystemNamespace).Update(ctx, cm, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update buildkit ConfigMap: %w", err)
	}

	return nil
}

// GetCurrentMaxParallelism retrieves the current max-parallelism setting from the buildkitd.toml
func (self *BuildkitSettingsManager) GetCurrentMaxParallelism(ctx context.Context) (int, error) {
	cm, err := self.GetBuildkitConfig(ctx)
	if err != nil {
		return 0, err
	}

	// Get the current buildkitd.toml content
	tomlContent, exists := cm.Data[BuildkitConfigKey]
	if !exists {
		return 0, fmt.Errorf("buildkitd.toml not found in ConfigMap")
	}

	// Extract the max-parallelism value using regex
	re := regexp.MustCompile(`max-parallelism = (\d+)`)
	matches := re.FindStringSubmatch(tomlContent)

	if len(matches) < 2 {
		return 2, fmt.Errorf("max-parallelism setting not found in buildkitd.toml")
	}

	// Parse the value to int
	value, err := strconv.Atoi(matches[1])
	if err != nil {
		return 2, fmt.Errorf("invalid max-parallelism value: %w", err)
	}

	return value, nil
}

// UpdateReplicas updates the number of replicas for the buildkitd deployment
func (self *BuildkitSettingsManager) UpdateReplicas(ctx context.Context, replicas int) error {
	// Create a patch operation to update the replicas
	replicasInt32 := int32(replicas)
	patchBytes, err := json.Marshal([]map[string]any{
		{
			"op":    "replace",
			"path":  "/spec/replicas",
			"value": replicasInt32,
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create patch for replicas update: %w", err)
	}

	// Apply the patch to the deployment
	_, err = self.k8s.GetInternalClient().AppsV1().Deployments(self.cfg.SystemNamespace).Patch(
		ctx,
		BuildkitDeploymentName,
		types.JSONPatchType,
		patchBytes,
		metav1.PatchOptions{},
	)
	if err != nil {
		return fmt.Errorf("failed to update replicas for buildkitd deployment: %w", err)
	}

	return nil
}

// GetCurrentReplicas retrieves the current number of replicas for the buildkitd deployment
func (self *BuildkitSettingsManager) GetCurrentReplicas(ctx context.Context) (int, error) {
	deployment, err := self.k8s.GetInternalClient().AppsV1().Deployments(self.cfg.SystemNamespace).Get(ctx, BuildkitDeploymentName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return 0, fmt.Errorf("buildkitd deployment not found: %w", err)
		}
		return 0, fmt.Errorf("failed to get buildkitd deployment: %w", err)
	}

	// Return the current replica count
	return int(*deployment.Spec.Replicas), nil
}

// RestartBuildkitdPods restarts the buildkitd pods by adding a restart annotation to the deployment
func (self *BuildkitSettingsManager) RestartBuildkitdPods(ctx context.Context) error {
	deployment, err := self.k8s.GetInternalClient().AppsV1().Deployments(self.cfg.SystemNamespace).Get(ctx, BuildkitDeploymentName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return fmt.Errorf("buildkitd deployment not found: %w", err)
		}
		return fmt.Errorf("failed to get buildkitd deployment: %w", err)
	}

	// Update the annotations with a timestamp to force a rolling restart
	if deployment.Spec.Template.Annotations == nil {
		deployment.Spec.Template.Annotations = make(map[string]string)
	}

	// Add a restart timestamp annotation
	timestamp := time.Now().UTC().Format(time.RFC3339)
	deployment.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = timestamp

	// Update the deployment
	_, err = self.k8s.GetInternalClient().AppsV1().Deployments(self.cfg.SystemNamespace).Update(ctx, deployment, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to restart buildkitd pods: %w", err)
	}

	return nil
}
