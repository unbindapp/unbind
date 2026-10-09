package k3s

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-installer/internal/cloudinfo"
	"sigs.k8s.io/yaml"
)

func TestCloudSecretManifest(t *testing.T) {
	cases := map[cloudinfo.Provider]struct{ name, key string }{
		cloudinfo.Hetzner:      {"hcloud", "token"},
		cloudinfo.DigitalOcean: {"digitalocean", "access-token"},
	}
	for provider, want := range cases {
		manifest, err := cloudSecretManifest(provider, "s3cr3t: with yaml chars")
		require.NoError(t, err, provider)

		var secret struct {
			Kind       string `json:"kind"`
			Metadata   struct{ Name, Namespace string }
			StringData map[string]string `json:"stringData"`
		}
		require.NoError(t, yaml.Unmarshal([]byte(manifest), &secret), provider)
		assert.Equal(t, "Secret", secret.Kind)
		assert.Equal(t, want.name, secret.Metadata.Name)
		assert.Equal(t, "kube-system", secret.Metadata.Namespace)
		assert.Equal(t, map[string]string{want.key: "s3cr3t: with yaml chars"}, secret.StringData)
	}
}

func TestCloudSecretManifestUnknownProvider(t *testing.T) {
	_, err := cloudSecretManifest("nope", "token")
	assert.Error(t, err)
}
