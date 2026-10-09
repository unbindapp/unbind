package cloudinfo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type Provider string

const (
	Hetzner      Provider = "hetzner"
	DigitalOcean Provider = "digitalocean"
)

// Spec is everything the installer knows about a provider's block storage. Adding a
// provider means adding a row here plus its install recipe in the k3s package.
type Spec struct {
	Provider     Provider
	DisplayName  string
	DMIVendor    string
	VolumeName   string
	Provisioner  string
	StorageClass string
	MinGB        int
	MaxGB        int
	MaxPerServer int
	PricePerGB   string
	PriceNote    string
	TokenURL     string
	TokenHelp    string
}

// Limits and prices come from docs.hetzner.com/cloud/volumes and
// docs.digitalocean.com/products/volumes. The Hetzner figure is the April 2026 list price;
// the token check replaces it with the project's live price.
var specs = []Spec{
	{
		Provider:     Hetzner,
		DisplayName:  "Hetzner Cloud",
		DMIVendor:    "Hetzner",
		VolumeName:   "Hetzner Cloud Volumes",
		Provisioner:  "csi.hetzner.cloud",
		StorageClass: "hcloud-volumes",
		MinGB:        10,
		MaxGB:        10000,
		MaxPerServer: 16,
		PricePerGB:   "€0.0572",
		PriceNote:    "net, list price as of April 2026",
		TokenURL:     "https://console.hetzner.cloud",
		TokenHelp:    "Open the project this server belongs to, go to Security > API tokens and generate a token with Read & Write permissions.",
	},
	{
		Provider:     DigitalOcean,
		DisplayName:  "DigitalOcean",
		DMIVendor:    "DigitalOcean",
		VolumeName:   "DigitalOcean Volumes",
		Provisioner:  "dobs.csi.digitalocean.com",
		StorageClass: "do-block-storage",
		MinGB:        1,
		MaxGB:        16384,
		MaxPerServer: 15,
		PricePerGB:   "$0.10",
		PriceNote:    "list price",
		TokenURL:     "https://cloud.digitalocean.com/account/api/tokens",
		TokenHelp:    "Generate a personal access token with write access for the team this droplet belongs to.",
	},
}

func (p Provider) Spec() Spec {
	for _, spec := range specs {
		if spec.Provider == p {
			return spec
		}
	}
	return Spec{Provider: p, DisplayName: string(p)}
}

type Info struct {
	Provider   Provider
	InstanceID string
	Region     string
}

func (i *Info) Spec() Spec {
	return i.Provider.Spec()
}

var (
	sysVendorPath = "/sys/class/dmi/id/sys_vendor"
	metadataBase  = "http://169.254.169.254"
)

// Detect recognises the hosting provider the way cloud-init's ds-identify does, by the DMI
// system vendor. Metadata only adds the instance id, so nil means an unknown provider,
// never a transient network error.
func Detect(ctx context.Context, logFn func(string)) *Info {
	vendor, err := os.ReadFile(sysVendorPath)
	if err != nil {
		logFn("Could not read the DMI system vendor, assuming no cloud provider")
		return nil
	}

	provider, ok := providerFromVendor(string(vendor))
	if !ok {
		return nil
	}
	spec := provider.Spec()
	logFn("Detected " + spec.DisplayName + " as the hosting provider")

	info := &Info{Provider: provider}
	client := &http.Client{Timeout: 3 * time.Second}
	if err := fetchInstance(ctx, client, info); err != nil {
		logFn(fmt.Sprintf("Warning: could not read %s instance metadata: %v", spec.DisplayName, err))
	}
	return info
}

func providerFromVendor(vendor string) (Provider, bool) {
	vendor = strings.TrimSpace(vendor)
	for _, spec := range specs {
		if spec.DMIVendor == vendor {
			return spec.Provider, true
		}
	}
	return "", false
}

func fetchInstance(ctx context.Context, client *http.Client, info *Info) error {
	switch info.Provider {
	case Hetzner:
		id, err := getText(ctx, client, metadataBase+"/hetzner/v1/metadata/instance-id")
		if err != nil {
			return err
		}
		info.InstanceID = id
		return nil
	case DigitalOcean:
		body, err := getText(ctx, client, metadataBase+"/metadata/v1.json")
		if err != nil {
			return err
		}
		var md struct {
			DropletID json.Number `json:"droplet_id"`
			Region    string      `json:"region"`
		}
		if err := json.Unmarshal([]byte(body), &md); err != nil {
			return fmt.Errorf("unexpected metadata response: %w", err)
		}
		info.InstanceID = md.DropletID.String()
		info.Region = md.Region
		return nil
	default:
		return fmt.Errorf("unknown provider %q", info.Provider)
	}
}

func getText(ctx context.Context, client *http.Client, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d from %s", resp.StatusCode, url)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(body)), nil
}
