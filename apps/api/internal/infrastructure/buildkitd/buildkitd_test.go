package buildkitd

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

const chartToml = `[worker.oci]
# Limit concurrency of build steps:
max-parallelism = 2
[registry."docker-registry.unbind-system:5000"]
http = true
insecure = true

[frontend."dockerfile.v0"]
enabled = true
`

func TestRenderInsecureRegistries(t *testing.T) {
	t.Run("keeps worker gc bounds", func(t *testing.T) {
		withGC := `[worker.oci]
max-parallelism = 2
gc = true
reservedSpace = "5%"
maxUsedSpace = "20%"
minFreeSpace = "25%"
[registry."old.example:5000"]
http = true
insecure = true
[frontend."dockerfile.v0"]
enabled = true
`
		assert.Equal(t, `[worker.oci]
max-parallelism = 2
gc = true
reservedSpace = "5%"
maxUsedSpace = "20%"
minFreeSpace = "25%"
[registry."new.example:5000"]
http = true
insecure = true

[frontend."dockerfile.v0"]
enabled = true
`, renderInsecureRegistries(withGC, []string{"new.example:5000"}))
	})

	t.Run("unchanged when hosts match", func(t *testing.T) {
		assert.Equal(t, chartToml, renderInsecureRegistries(chartToml, []string{"docker-registry.unbind-system:5000"}))
	})

	t.Run("strips all blocks when no hosts", func(t *testing.T) {
		assert.Equal(t, `[worker.oci]
# Limit concurrency of build steps:
max-parallelism = 2
[frontend."dockerfile.v0"]
enabled = true
`, renderInsecureRegistries(chartToml, nil))
	})

	t.Run("replaces blocks with new hosts", func(t *testing.T) {
		withCA := `[worker.oci]
max-parallelism = 4
[registry."old.example:5000"]
http = true
insecure = true
ca = ["/etc/ca.pem"]

[frontend."dockerfile.v0"]
enabled = true
`
		assert.Equal(t, `[worker.oci]
max-parallelism = 4
[registry."a.example:5000"]
http = true
insecure = true
[registry."b.example"]
http = true
insecure = true

[frontend."dockerfile.v0"]
enabled = true
`, renderInsecureRegistries(withCA, []string{"a.example:5000", "b.example"}))
	})

	t.Run("appends when no frontend section", func(t *testing.T) {
		assert.Equal(t, `[worker.oci]
max-parallelism = 2
[registry."a.example:5000"]
http = true
insecure = true
`, renderInsecureRegistries("[worker.oci]\nmax-parallelism = 2\n", []string{"a.example:5000"}))
	})
}
