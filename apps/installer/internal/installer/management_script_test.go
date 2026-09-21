package installer

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-installer/internal/k3s"
)

func TestRenderManagementScript(t *testing.T) {
	script := renderManagementScript()

	for _, placeholder := range []string{"__HOST_CONFIG_PATH__", "__KUBELET_CONFIG_PATH__", "__KUBELET_CONFIG__", "__KUBELET_ARGS__", "__SERVER_FLAGS__"} {
		require.NotContains(t, script, placeholder)
	}
	require.Contains(t, script, "CONFIG_FILE=\""+k3s.UnbindHostConfigPath+"\"")
	require.Contains(t, script, "KUBELET_CONFIG_PATH=\""+k3s.KubeletConfigPath+"\"")
	require.Contains(t, script, "KUBELET_ARGS=\""+k3s.KubeletArgs+"\"")
	require.Contains(t, script, "SERVER_FLAGS=\""+k3s.ServerInstallFlags+"\"")
	require.Contains(t, script, "imageMaximumGCAge: 72h\nKUBELETEOF")
	require.Contains(t, script, "INSTALL_K3S_SKIP_DOWNLOAD=true INSTALL_K3S_EXEC=\"$SERVER_FLAGS\" sh -")

	bash, err := exec.LookPath("bash")
	if err != nil {
		t.Skip("bash not available")
	}
	path := filepath.Join(t.TempDir(), "unbind")
	require.NoError(t, os.WriteFile(path, []byte(script), 0755))
	out, err := exec.Command(bash, "-n", path).CombinedOutput()
	require.NoError(t, err, strings.TrimSpace(string(out)))
}
