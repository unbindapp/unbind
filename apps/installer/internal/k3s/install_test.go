package k3s

import (
	"testing"

	"github.com/stretchr/testify/require"
	"sigs.k8s.io/yaml"
)

func TestKubeletConfigKeepsDiskEvictionSignals(t *testing.T) {
	var parsed struct {
		EvictionHard                map[string]string `json:"evictionHard"`
		EvictionMinimumReclaim      map[string]string `json:"evictionMinimumReclaim"`
		ImageGCHighThresholdPercent int               `json:"imageGCHighThresholdPercent"`
		ImageGCLowThresholdPercent  int               `json:"imageGCLowThresholdPercent"`
		ImageMaximumGCAge           string            `json:"imageMaximumGCAge"`
	}
	require.NoError(t, yaml.Unmarshal([]byte(kubeletConfig), &parsed))

	for _, signal := range []string{"memory.available", "nodefs.available", "nodefs.inodesFree", "imagefs.available"} {
		require.Contains(t, parsed.EvictionHard, signal)
	}
	require.Contains(t, parsed.EvictionMinimumReclaim, "nodefs.available")
	require.Contains(t, parsed.EvictionMinimumReclaim, "imagefs.available")
	require.Less(t, parsed.ImageGCLowThresholdPercent, parsed.ImageGCHighThresholdPercent)
	require.LessOrEqual(t, parsed.ImageGCHighThresholdPercent, 85)
	require.Equal(t, "72h", parsed.ImageMaximumGCAge)
}
