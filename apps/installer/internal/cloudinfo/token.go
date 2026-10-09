package cloudinfo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

var (
	ErrInvalidToken = errors.New("the API token was rejected")
	ErrWrongProject = errors.New("the token works, but its project does not contain this server")

	hetznerAPIBase      = "https://api.hetzner.cloud/v1"
	digitalOceanAPIBase = "https://api.digitalocean.com/v2"
)

type TokenCheck struct {
	// Live net price per GB and month in the provider's currency, empty when unavailable.
	VolumePricePerGB string
}

// CheckToken verifies the token can see this very server, so a token for another project or
// account is caught before the CSI driver fails to attach volumes.
func CheckToken(ctx context.Context, info *Info, token string) (*TokenCheck, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	return checkToken(ctx, client, info, token)
}

func checkToken(ctx context.Context, client *http.Client, info *Info, token string) (*TokenCheck, error) {
	switch info.Provider {
	case Hetzner:
		if err := expectOwnServer(ctx, client, serverURL(hetznerAPIBase+"/servers", info.InstanceID), token); err != nil {
			return nil, err
		}
		return &TokenCheck{VolumePricePerGB: hetznerVolumePrice(ctx, client, token)}, nil
	case DigitalOcean:
		if err := expectOwnServer(ctx, client, serverURL(digitalOceanAPIBase+"/droplets", info.InstanceID), token); err != nil {
			return nil, err
		}
		return &TokenCheck{}, nil
	default:
		return nil, fmt.Errorf("unknown provider %q", info.Provider)
	}
}

// Without an instance id from metadata only the token itself can be checked.
func serverURL(collection, instanceID string) string {
	if instanceID == "" {
		return collection + "?per_page=1"
	}
	return collection + "/" + instanceID
}

func expectOwnServer(ctx context.Context, client *http.Client, url, token string) error {
	resp, err := getWithBearer(ctx, client, url, token)
	if err != nil {
		return fmt.Errorf("could not reach %s: %w", url, err)
	}
	resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		return nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return ErrInvalidToken
	case http.StatusNotFound:
		return ErrWrongProject
	default:
		return fmt.Errorf("unexpected status %d from %s", resp.StatusCode, url)
	}
}

func hetznerVolumePrice(ctx context.Context, client *http.Client, token string) string {
	resp, err := getWithBearer(ctx, client, hetznerAPIBase+"/pricing", token)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}

	var payload struct {
		Pricing struct {
			Volume struct {
				PricePerGBMonth struct {
					Net string `json:"net"`
				} `json:"price_per_gb_month"`
			} `json:"volume"`
		} `json:"pricing"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4*1024*1024)).Decode(&payload); err != nil {
		return ""
	}
	net, err := strconv.ParseFloat(payload.Pricing.Volume.PricePerGBMonth.Net, 64)
	if err != nil || net <= 0 {
		return ""
	}
	return fmt.Sprintf("€%.4f", net)
}

func getWithBearer(ctx context.Context, client *http.Client, url, token string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return client.Do(req)
}
