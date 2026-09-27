package registrycache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/log"
)

const manifestAccept = "application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json"

const digestHeader = "Docker-Content-Digest"

type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

type Manifest struct {
	Digest    string
	Manifests []struct {
		Digest string `json:"digest"`
	} `json:"manifests"`
	Config struct {
		Digest string `json:"digest"`
		Size   int64  `json:"size"`
	} `json:"config"`
	Layers []struct {
		Digest string `json:"digest"`
		Size   int64  `json:"size"`
	} `json:"layers"`
}

func (self *Client) Repositories(ctx context.Context) ([]string, error) {
	var out struct {
		Repositories []string `json:"repositories"`
	}
	if err := self.getJSON(ctx, fmt.Sprintf("%s/v2/_catalog", self.baseURL), nil, &out); err != nil {
		return nil, err
	}
	sort.Strings(out.Repositories)
	return out.Repositories, nil
}

func (self *Client) Tags(ctx context.Context, repo string) ([]string, error) {
	var out struct {
		Tags []string `json:"tags"`
	}
	if err := self.getJSON(ctx, fmt.Sprintf("%s/v2/%s/tags/list", self.baseURL, repo), nil, &out); err != nil {
		return nil, err
	}
	return out.Tags, nil
}

func (self *Client) Manifest(ctx context.Context, repo, ref string) (*Manifest, error) {
	manifest := &Manifest{}
	headers := map[string]string{"Accept": manifestAccept}
	resp, err := self.get(ctx, fmt.Sprintf("%s/v2/%s/manifests/%s", self.baseURL, repo, ref), headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := json.NewDecoder(resp.Body).Decode(manifest); err != nil {
		return nil, err
	}
	manifest.Digest = resp.Header.Get(digestHeader)
	return manifest, nil
}

func (self *Client) DeleteManifest(ctx context.Context, repo, digest string) error {
	endpoint := fmt.Sprintf("%s/v2/%s/manifests/%s", self.baseURL, repo, url.PathEscape(digest))
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return err
	}

	resp, err := self.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("registry returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

var ErrImageIncomplete = errors.New("image incomplete in registry")

// VerifyImage checks the registry can serve every manifest and blob of an image. A GC that overlapped the push leaves gaps.
func (self *Client) VerifyImage(ctx context.Context, repo, ref string) error {
	return self.verifyManifest(ctx, repo, ref, 0)
}

func (self *Client) verifyManifest(ctx context.Context, repo, ref string, depth int) error {
	if depth > manifestIndexDepth {
		return nil
	}
	exists, err := self.exists(ctx, fmt.Sprintf("%s/v2/%s/manifests/%s", self.baseURL, repo, ref), manifestAccept)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("%w: manifest %s@%s is missing", ErrImageIncomplete, repo, ref)
	}

	manifest, err := self.Manifest(ctx, repo, ref)
	if err != nil {
		return err
	}
	for _, child := range manifest.Manifests {
		if err := self.verifyManifest(ctx, repo, child.Digest, depth+1); err != nil {
			return err
		}
	}

	blobs := make([]string, 0, len(manifest.Layers)+1)
	if manifest.Config.Digest != "" {
		blobs = append(blobs, manifest.Config.Digest)
	}
	for _, layer := range manifest.Layers {
		blobs = append(blobs, layer.Digest)
	}
	for _, digest := range blobs {
		exists, err := self.exists(ctx, fmt.Sprintf("%s/v2/%s/blobs/%s", self.baseURL, repo, digest), "")
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("%w: blob %s of %s:%s is missing", ErrImageIncomplete, digest, repo, ref)
		}
	}
	return nil
}

func (self *Client) exists(ctx context.Context, endpoint, accept string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, endpoint, nil)
	if err != nil {
		return false, err
	}
	if accept != "" {
		req.Header.Set("Accept", accept)
	}

	resp, err := self.http.Do(req)
	if err != nil {
		return false, err
	}
	resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		return true, nil
	case http.StatusNotFound:
		return false, nil
	}
	return false, fmt.Errorf("registry returned %d for %s", resp.StatusCode, endpoint)
}

func (self *Client) getJSON(ctx context.Context, endpoint string, headers map[string]string, out any) error {
	resp, err := self.get(ctx, endpoint, headers)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(out)
}

func (self *Client) get(ctx context.Context, endpoint string, headers map[string]string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := self.http.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		resp.Body.Close()
		return nil, fmt.Errorf("registry returned %d: %s", resp.StatusCode, string(body))
	}
	return resp, nil
}

func collectBlobs(ctx context.Context, client *Client, repo, ref string, blobs map[string]int64, depth int) error {
	if depth > manifestIndexDepth {
		return nil
	}

	manifest, err := client.Manifest(ctx, repo, ref)
	if err != nil {
		return err
	}

	if len(manifest.Manifests) > 0 {
		for _, sub := range manifest.Manifests {
			if err := collectBlobs(ctx, client, repo, sub.Digest, blobs, depth+1); err != nil {
				log.Warnf("registry cache: failed sub-manifest %s@%s: %v", repo, sub.Digest, err)
			}
		}
		return nil
	}

	if manifest.Config.Digest != "" {
		blobs[manifest.Config.Digest] = manifest.Config.Size
	}
	for _, layer := range manifest.Layers {
		blobs[layer.Digest] = layer.Size
	}
	return nil
}
