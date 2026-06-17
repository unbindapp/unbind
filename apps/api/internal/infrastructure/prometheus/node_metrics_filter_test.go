package prometheus

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/suite"
)

type NodeMetricsFilterTestSuite struct {
	suite.Suite
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeLabelSelector_NilFilter() {
	result := buildNodeLabelSelector(nil)
	s.Equal("", result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeLabelSelector_EmptyFilter() {
	filter := &NodeMetricsFilter{}
	result := buildNodeLabelSelector(filter)
	s.Equal("", result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeLabelSelector_EmptyNodeNames() {
	filter := &NodeMetricsFilter{
		NodeName: []string{},
	}
	result := buildNodeLabelSelector(filter)
	s.Equal("", result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeLabelSelector_SingleNodeName() {
	filter := &NodeMetricsFilter{
		NodeName: []string{"worker-node-1"},
	}
	result := buildNodeLabelSelector(filter)
	expected := `, nodename="worker-node-1"`
	s.Equal(expected, result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeLabelSelector_MultipleNodeNames() {
	filter := &NodeMetricsFilter{
		NodeName: []string{"worker-node-1", "worker-node-2", "master-node-1"},
	}
	result := buildNodeLabelSelector(filter)
	expected := `, nodename=~"worker-node-1|worker-node-2|master-node-1"`
	s.Equal(expected, result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeLabelSelector_TwoNodeNames() {
	filter := &NodeMetricsFilter{
		NodeName: []string{"node-1", "node-2"},
	}
	result := buildNodeLabelSelector(filter)
	expected := `, nodename=~"node-1|node-2"`
	s.Equal(expected, result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildLabelValueFilter_EmptyValues() {
	result := buildLabelValueFilter("test_label", []string{})
	s.Equal("", result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildLabelValueFilter_SingleValue() {
	result := buildLabelValueFilter("node_name", []string{"worker-1"})
	expected := `, node_name="worker-1"`
	s.Equal(expected, result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildLabelValueFilter_MultipleValues() {
	result := buildLabelValueFilter("environment", []string{"prod", "staging", "dev"})
	expected := `, environment=~"prod|staging|dev"`
	s.Equal(expected, result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildLabelValueFilter_SpecialCharacters() {
	// Test with node names containing special characters
	result := buildLabelValueFilter("nodename", []string{"node-1.example.com", "node_2-worker"})
	expected := `, nodename=~"node-1.example.com|node_2-worker"`
	s.Equal(expected, result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildLabelValueFilter_OrderConsistency() {
	// Test that the order of values is preserved
	values := []string{"alpha", "beta", "gamma", "delta"}
	result := buildLabelValueFilter("test", values)
	expected := `, test=~"alpha|beta|gamma|delta"`
	s.Equal(expected, result)
}

func (s *NodeMetricsFilterTestSuite) TestNodeMetricsStruct() {
	// Test that NodeMetrics struct has all expected fields
	metrics := &NodeMetrics{}

	// Verify all fields exist by assigning to them
	s.NotPanics(func() {
		metrics.CPU = nil
		metrics.RAM = nil
		metrics.Network = nil
		metrics.Disk = nil
		metrics.FileSystem = nil
		metrics.Load = nil
	})
}

func (s *NodeMetricsFilterTestSuite) TestNodeMetricsFilter_VariousNodeNameFormats() {
	testCases := []struct {
		name      string
		nodeNames []string
		expected  string
	}{
		{
			name:      "Simple node names",
			nodeNames: []string{"node1", "node2"},
			expected:  `, nodename=~"node1|node2"`,
		},
		{
			name:      "FQDN node names",
			nodeNames: []string{"node1.cluster.local", "node2.cluster.local"},
			expected:  `, nodename=~"node1.cluster.local|node2.cluster.local"`,
		},
		{
			name:      "Mixed formats",
			nodeNames: []string{"master", "worker-1.example.com", "node_with_underscores"},
			expected:  `, nodename=~"master|worker-1.example.com|node_with_underscores"`,
		},
		{
			name:      "IP-based node names",
			nodeNames: []string{"192.168.1.10", "10.0.0.1"},
			expected:  `, nodename=~"192.168.1.10|10.0.0.1"`,
		},
		{
			name:      "Kubernetes node naming",
			nodeNames: []string{"gke-cluster-default-pool-abc123", "aks-nodepool1-12345678-vmss000000"},
			expected:  `, nodename=~"gke-cluster-default-pool-abc123|aks-nodepool1-12345678-vmss000000"`,
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			filter := &NodeMetricsFilter{
				NodeName: tc.nodeNames,
			}
			result := buildNodeLabelSelector(filter)
			s.Equal(tc.expected, result)
		})
	}
}

func (s *NodeMetricsFilterTestSuite) TestNodeMetricsFilter_LargeNumberOfNodes() {
	// Test with a large number of node names
	nodeNames := make([]string, 100)
	for i := 0; i < 100; i++ {
		nodeNames[i] = fmt.Sprintf("node-%03d", i)
	}

	filter := &NodeMetricsFilter{
		NodeName: nodeNames,
	}
	result := buildNodeLabelSelector(filter)

	// Should start with regex format
	s.True(len(result) > 0)
	s.Contains(result, "nodename=~")

	// Should contain all node names
	for _, nodeName := range nodeNames {
		s.Contains(result, nodeName)
	}
}

func (s *NodeMetricsFilterTestSuite) TestNodeMetricsFilter_NilValues() {
	// Test that nil slice is handled properly
	filter := &NodeMetricsFilter{
		NodeName: nil,
	}
	result := buildNodeLabelSelector(filter)
	s.Equal("", result)
}

func TestNodeMetricsFilterTestSuite(t *testing.T) {
	suite.Run(t, new(NodeMetricsFilterTestSuite))
}
