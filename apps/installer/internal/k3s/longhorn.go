package k3s

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

const LonghornVersion = "1.13.0"

func (self *Installer) installLonghorn(ctx context.Context, kubeconfigPath string) error {
	// Enable and start iSCSI daemon (required for Longhorn)
	self.log("Enabling iSCSI daemon for Longhorn storage...")
	iscsidCmd := exec.CommandContext(ctx, "systemctl", "enable", "--now", "iscsid")
	if output, err := iscsidCmd.CombinedOutput(); err != nil {
		// Log warning but don't fail the installation
		self.log(fmt.Sprintf("Warning: Failed to enable iscsid service: %v, output: %s", err, string(output)))
	} else {
		self.log("iSCSI daemon enabled successfully")
	}

	// Add Longhorn Helm repo
	self.log("Adding Longhorn Helm repository...")
	repoCmd := exec.CommandContext(ctx, "helm", "repo", "add", "longhorn", "https://charts.longhorn.io")
	if output, err := repoCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to add Longhorn Helm repo: %w, output: %s", err, string(output))
	}

	// Update Helm repos
	self.log("Updating Helm repositories...")
	updateCmd := exec.CommandContext(ctx, "helm", "repo", "update")
	if output, err := updateCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to update Helm repos: %w, output: %s", err, string(output))
	}

	// Install Longhorn
	self.log("Installing Longhorn...")
	installCmd := exec.CommandContext(ctx, "helm", "install", "longhorn", "longhorn/longhorn",
		"--namespace", "longhorn-system",
		"--create-namespace",
		"--version", LonghornVersion,
		"--set", "defaultSettings.admissionWebhookTimeout=30",
		"--set", "defaultSettings.conversionWebhookTimeout=30",
		"--set", "defaultSettings.defaultReplicaCount=1",
		"--set", "defaultSettings.replicaSoftAntiAffinity=true",
		"--set", "defaultSettings.replicaAutoBalance=disabled",
		"--set", "defaultSettings.disableRevisionCounter=true",
		"--set", "defaultSettings.upgradeChecker=false",
		"--set", "defaultSettings.autoSalvage=true",
		"--set", "defaultSettings.storageOverProvisioningPercentage=150",
		"--set", "defaultSettings.storageMinimalAvailablePercentage=10",
		"--set", "defaultSettings.concurrentReplicaRebuildPerNodeLimit=0",
		"--set", "defaultSettings.concurrentVolumeBackupRestorePerNodeLimit=0",
		"--set", "defaultSettings.concurrentAutomaticEngineUpgradePerNodeLimit=0",
		"--set", "defaultSettings.guaranteedInstanceManagerCPU=0",
		"--set", "defaultSettings.kubernetesClusterAutoscalerEnabled=false",
		"--set", "defaultSettings.autoCleanupSystemGeneratedSnapshot=true",
		"--set", "defaultSettings.orphanResourceAutoDeletion=replica-data",
		"--set", "defaultSettings.disableSchedulingOnCordonedNode=true",
		"--set", "defaultSettings.fastReplicaRebuildEnabled=false",
		"--set", "longhornUI.enabled=false",
		"--set", "enableShareManager=false",
		"--set", "enableUpgradeChecker=false",
		"--set", "enablePSP=false",
		"--set", "longhornDriverDeployer.enabled=false",
		"--set", "driver.debug=false",
		"--set", "longhornManager.resources.requests.cpu=50m",
		"--set", "longhornManager.resources.requests.memory=128Mi",
		"--set", "longhornManager.resources.limits.cpu=100m",
		"--set", "longhornManager.resources.limits.memory=256Mi",
		"--set", "instanceManager.resources.requests.cpu=40m",
		"--set", "instanceManager.resources.requests.memory=64Mi",
		"--set", "instanceManager.resources.limits.cpu=200m",
		"--set", "instanceManager.resources.limits.memory=256Mi",
		"--set", "csi.attacherReplicaCount=1",
		"--set", "csi.provisionerReplicaCount=1",
		"--set", "csi.resizerReplicaCount=1",
		"--set", "csi.snapshotterReplicaCount=0",
		"--set", "csi.kubeletPlugin.resources.requests.cpu=10m",
		"--set", "csi.kubeletPlugin.resources.requests.memory=32Mi",
		"--set", "csi.kubeletPlugin.resources.limits.cpu=50m",
		"--set", "csi.kubeletPlugin.resources.limits.memory=128Mi",
		"--set", "persistence.defaultClass=true",
		"--set", "persistence.defaultClassReplicaCount=1",
		"--set", "persistence.defaultDataLocality=best-effort",
		"--set", "persistence.reclaimPolicy=Retain",
	)

	// Set KUBECONFIG environment variable
	installCmd.Env = append(os.Environ(), fmt.Sprintf("KUBECONFIG=%s", kubeconfigPath))

	if output, err := installCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to install Longhorn: %w, output: %s", err, string(output))
	}

	// Wait for Longhorn to be ready
	self.log("Waiting for Longhorn to be ready...")
	if err := self.waitForLonghornReady(ctx, kubeconfigPath); err != nil {
		return err
	}

	// Longhorn re-adds the annotation on its own class only, so this is a repeat check after install.
	if err := self.demoteLocalPath(ctx, kubeconfigPath); err != nil {
		self.log(fmt.Sprintf("Warning: %v", err))
	}
	return nil
}

// waitForLonghornReady polls until the longhorn-manager pods are ready. A single
// `kubectl wait` races the controllers that create those pods and exits
// immediately with "no matching resources found" when none exist yet, so retry
// with a short per-attempt timeout until they appear and become ready, or the
// overall deadline passes.
func (self *Installer) waitForLonghornReady(ctx context.Context, kubeconfigPath string) error {
	deadline := time.Now().Add(6 * time.Minute)
	env := append(os.Environ(), fmt.Sprintf("KUBECONFIG=%s", kubeconfigPath))

	var lastErr error
	var lastOutput string
	for attempt := 1; time.Now().Before(deadline); attempt++ {
		if ctx.Err() != nil {
			return fmt.Errorf("failed waiting for Longhorn to be ready: %w", ctx.Err())
		}

		cmd := exec.CommandContext(ctx, "kubectl", "wait", "--for=condition=ready", "pod",
			"-l", "app=longhorn-manager", "-n", "longhorn-system", "--timeout=30s")
		cmd.Env = env
		output, err := cmd.CombinedOutput()
		if err == nil {
			return nil
		}

		lastErr = err
		lastOutput = strings.TrimSpace(string(output))
		self.log(fmt.Sprintf("Longhorn not ready yet (attempt %d): %s", attempt, lastOutput))

		select {
		case <-time.After(5 * time.Second):
		case <-ctx.Done():
			return fmt.Errorf("failed waiting for Longhorn to be ready: %w", ctx.Err())
		}
	}

	return fmt.Errorf("timed out waiting for Longhorn to be ready: %w, output: %s", lastErr, lastOutput)
}
