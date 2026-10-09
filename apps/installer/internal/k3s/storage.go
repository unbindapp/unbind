package k3s

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/unbindapp/unbind-installer/internal/cloudinfo"
	"sigs.k8s.io/yaml"
)

type StorageBackend int

const (
	StorageLonghorn StorageBackend = iota
	StorageCloudVolumes
)

type StorageOptions struct {
	Backend StorageBackend
	Cloud   *cloudinfo.Info
	Token   string
}

const (
	hetznerCSIChartVersion   = "2.23.0"
	digitalOceanCSIVersion   = "v4.19.0"
	digitalOceanManifestBase = "https://raw.githubusercontent.com/digitalocean/csi-digitalocean/master/deploy/kubernetes/releases/csi-digitalocean-" + digitalOceanCSIVersion
	csiReadyTimeout          = 5 * time.Minute
)

func (self *Installer) installStorage(ctx context.Context, kubeconfigPath string, opts StorageOptions) error {
	if err := self.demoteLocalPath(ctx, kubeconfigPath); err != nil {
		self.log(fmt.Sprintf("Warning: %v", err))
	}

	switch opts.Backend {
	case StorageCloudVolumes:
		return self.installCloudVolumes(ctx, kubeconfigPath, opts)
	default:
		return self.installLonghorn(ctx, kubeconfigPath)
	}
}

// k3s ships local-path as the default class; drop the annotation so the storage
// backend installed next becomes the single default. kubectl patch cannot select by
// label, so the class is targeted by name.
func (self *Installer) demoteLocalPath(ctx context.Context, kubeconfigPath string) error {
	self.log("Removing default annotation from the local-path StorageClass...")
	output, err := self.kubectl(ctx, kubeconfigPath, nil, "patch", "storageclass", "local-path", "--type=json", "-p",
		`[{"op": "replace", "path": "/metadata/annotations/storageclass.kubernetes.io~1is-default-class", "value": "false"}]`)
	if err != nil {
		return fmt.Errorf("failed to remove default annotation from local-path StorageClass: %s", output)
	}
	return nil
}

func (self *Installer) installCloudVolumes(ctx context.Context, kubeconfigPath string, opts StorageOptions) error {
	if opts.Cloud == nil || opts.Token == "" {
		return fmt.Errorf("cloud volumes selected without a provider or token")
	}
	spec := opts.Cloud.Spec()
	self.log("Installing the " + spec.VolumeName + " driver...")

	manifest, err := cloudSecretManifest(opts.Cloud.Provider, opts.Token)
	if err != nil {
		return err
	}
	if output, err := self.kubectl(ctx, kubeconfigPath, strings.NewReader(manifest), "apply", "-f", "-"); err != nil {
		return fmt.Errorf("failed to store the %s API token: %s", spec.DisplayName, output)
	}

	switch opts.Cloud.Provider {
	case cloudinfo.Hetzner:
		err = self.installHetznerCSI(ctx, kubeconfigPath)
	case cloudinfo.DigitalOcean:
		err = self.installDigitalOceanCSI(ctx, kubeconfigPath)
	default:
		err = fmt.Errorf("no install recipe for provider %q", opts.Cloud.Provider)
	}
	if err != nil {
		return err
	}

	self.log("Waiting for the " + spec.VolumeName + " driver to register on this server...")
	if err := self.waitForCSIDriver(ctx, kubeconfigPath, spec); err != nil {
		return err
	}
	self.log(spec.VolumeName + " ready: new volumes use the " + spec.StorageClass + " storage class")
	return nil
}

// Token secrets per the drivers' docs: hcloud/token for Hetzner, digitalocean/access-token
// for DigitalOcean, both in kube-system.
func cloudSecretManifest(provider cloudinfo.Provider, token string) (string, error) {
	var name, key string
	switch provider {
	case cloudinfo.Hetzner:
		name, key = "hcloud", "token"
	case cloudinfo.DigitalOcean:
		name, key = "digitalocean", "access-token"
	default:
		return "", fmt.Errorf("no token secret layout for provider %q", provider)
	}

	secret := map[string]any{
		"apiVersion": "v1",
		"kind":       "Secret",
		"metadata":   map[string]any{"name": name, "namespace": "kube-system"},
		"type":       "Opaque",
		"stringData": map[string]string{key: token},
	}
	out, err := yaml.Marshal(secret)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func (self *Installer) installHetznerCSI(ctx context.Context, kubeconfigPath string) error {
	if err := self.helmRepoAdd(ctx, "hcloud", "https://charts.hetzner.cloud"); err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, "helm", "upgrade", "--install", "hcloud-csi", "hcloud/hcloud-csi",
		"--namespace", "kube-system",
		"--version", hetznerCSIChartVersion,
		"--set", "controller.replicaCount=1",
	)
	cmd.Env = append(os.Environ(), "KUBECONFIG="+kubeconfigPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to install the Hetzner CSI driver: %w, output: %s", err, output)
	}
	return nil
}

// Unbind never takes VolumeSnapshots, so the upstream snapshot controller is left out.
func (self *Installer) installDigitalOceanCSI(ctx context.Context, kubeconfigPath string) error {
	for _, file := range []string{"crds.yaml", "driver.yaml"} {
		output, err := self.kubectl(ctx, kubeconfigPath, nil, "apply", "-f", digitalOceanManifestBase+"/"+file)
		if err != nil {
			return fmt.Errorf("failed to apply the DigitalOcean CSI %s: %s", file, output)
		}
	}
	return nil
}

func (self *Installer) helmRepoAdd(ctx context.Context, name, url string) error {
	if output, err := exec.CommandContext(ctx, "helm", "repo", "add", name, url, "--force-update").CombinedOutput(); err != nil {
		return fmt.Errorf("failed to add the %s Helm repo: %w, output: %s", name, err, output)
	}
	if output, err := exec.CommandContext(ctx, "helm", "repo", "update", name).CombinedOutput(); err != nil {
		return fmt.Errorf("failed to update the %s Helm repo: %w, output: %s", name, err, output)
	}
	return nil
}

// Ready means the node plugin registered with the kubelet and the driver's class is the
// cluster default, which is what every PVC Unbind creates relies on.
func (self *Installer) waitForCSIDriver(ctx context.Context, kubeconfigPath string, spec cloudinfo.Spec) error {
	deadline := time.Now().Add(csiReadyTimeout)
	for time.Now().Before(deadline) {
		drivers, _ := self.kubectl(ctx, kubeconfigPath, nil, "get", "csinodes", "-o",
			`jsonpath={range .items[*]}{range .spec.drivers[*]}{.name}{"\n"}{end}{end}`)
		defaultClass, _ := self.kubectl(ctx, kubeconfigPath, nil, "get", "storageclass", spec.StorageClass, "-o",
			`jsonpath={.metadata.annotations.storageclass\.kubernetes\.io/is-default-class}`)
		if strings.Contains(drivers, spec.Provisioner) && strings.TrimSpace(defaultClass) == "true" {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(5 * time.Second):
		}
	}
	return fmt.Errorf("the %s driver did not become ready within %s", spec.VolumeName, csiReadyTimeout)
}

func (self *Installer) kubectl(ctx context.Context, kubeconfigPath string, stdin *strings.Reader, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "kubectl", args...)
	cmd.Env = append(os.Environ(), "KUBECONFIG="+kubeconfigPath)
	if stdin != nil {
		cmd.Stdin = stdin
	}
	output, err := cmd.CombinedOutput()
	return string(output), err
}
