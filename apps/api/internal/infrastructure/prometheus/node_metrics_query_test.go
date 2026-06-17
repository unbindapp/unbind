package prometheus

import (
	"context"
	"fmt"
	"testing"
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	mocks_promapi "github.com/unbindapp/unbind-api/mocks/promapi"
)

type NodeMetricsQueryTestSuite struct {
	suite.Suite
	client    *PrometheusClient
	mockAPI   *mocks_promapi.PromAPIInterfaceMock
	ctx       context.Context
	cancel    context.CancelFunc
	testStart time.Time
	testEnd   time.Time
	testStep  time.Duration
}

func (s *NodeMetricsQueryTestSuite) SetupTest() {
	s.ctx, s.cancel = context.WithTimeout(context.Background(), 5*time.Second)

	s.mockAPI = mocks_promapi.NewPromAPIInterfaceMock(s.T())
	s.client = &PrometheusClient{
		cfg: &config.Config{PrometheusEndpoint: "http://prometheus:9090"},
		api: s.mockAPI,
	}

	// Setup test time range
	s.testEnd = time.Now().Truncate(time.Minute)
	s.testStart = s.testEnd.Add(-1 * time.Hour)
	s.testStep = 5 * time.Minute
}

func (s *NodeMetricsQueryTestSuite) TearDownTest() {
	if s.cancel != nil {
		s.cancel()
	}
	s.mockAPI.AssertExpectations(s.T())
}

func (s *NodeMetricsQueryTestSuite) createNodeSampleMatrix(nodeName string, values []model.SamplePair) model.Matrix {
	return model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{
				"nodename": model.LabelValue(nodeName),
			},
			Values: values,
		},
	}
}

func (s *NodeMetricsQueryTestSuite) createTestSamples() []model.SamplePair {
	samples := make([]model.SamplePair, 5)
	for i := 0; i < 5; i++ {
		timestamp := s.testStart.Add(time.Duration(i) * s.testStep)
		samples[i] = model.SamplePair{
			Timestamp: model.Time(timestamp.Unix() * 1000),
			Value:     model.SampleValue(float64(i) * 15.75),
		}
	}
	return samples
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_Success() {
	samples := s.createTestSamples()
	filter := &NodeMetricsFilter{
		NodeName: []string{"node-1"},
	}

	// Mock all six node metric queries
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_cpu_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_memory_MemTotal_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_network_receive_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_disk_read_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_filesystem_size_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_load1")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.NoError(err)
	s.NotNil(result)
	s.Len(result, 1)

	nodeMetrics := result["node-1"]
	s.NotNil(nodeMetrics)
	s.Equal(samples, nodeMetrics.CPU)
	s.Equal(samples, nodeMetrics.RAM)
	s.Equal(samples, nodeMetrics.Network)
	s.Equal(samples, nodeMetrics.Disk)
	s.Equal(samples, nodeMetrics.FileSystem)
	s.Equal(samples, nodeMetrics.Load)
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_CPUQueryError() {
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_cpu_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("CPU query failed"),
	)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying node CPU metrics")
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_RAMQueryError() {
	samples := s.createTestSamples()
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_cpu_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_memory_MemTotal_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("RAM query failed"),
	)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying node RAM metrics")
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_NetworkQueryError() {
	samples := s.createTestSamples()
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}

	// Mock successful CPU and RAM queries
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_cpu_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_memory_MemTotal_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	// Mock failed network query
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_network_receive_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("Network query failed"),
	)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying node network metrics")
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_DiskQueryError() {
	samples := s.createTestSamples()
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}

	// Mock first three successful queries
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_cpu_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_memory_MemTotal_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_network_receive_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	// Mock failed disk query
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_disk_read_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("Disk query failed"),
	)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying node disk metrics")
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_FileSystemQueryError() {
	samples := s.createTestSamples()
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}

	// Mock first four successful queries
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_cpu_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_memory_MemTotal_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_network_receive_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_disk_read_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	// Mock failed filesystem query
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_filesystem_size_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("FileSystem query failed"),
	)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying node filesystem metrics")
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_LoadQueryError() {
	samples := s.createTestSamples()
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}

	// Mock first five successful queries
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_cpu_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_memory_MemTotal_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_network_receive_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_disk_read_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_filesystem_size_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	)

	// Mock failed load query
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "node_load1")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("Load query failed"),
	)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying node load metrics")
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_EmptyResults() {
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}
	emptyMatrix := model.Matrix{}

	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("v1.Range")).Return(
		emptyMatrix, v1.Warnings{}, nil,
	).Times(6)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.NoError(err)
	s.NotNil(result)
	s.Empty(result)
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_MultipleNodes() {
	samples1 := s.createTestSamples()
	samples2 := make([]model.SamplePair, 3)
	for i := 0; i < 3; i++ {
		timestamp := s.testStart.Add(time.Duration(i) * s.testStep)
		samples2[i] = model.SamplePair{
			Timestamp: model.Time(timestamp.Unix() * 1000),
			Value:     model.SampleValue(float64(i) * 25.5),
		}
	}

	filter := &NodeMetricsFilter{NodeName: []string{"node-1", "node-2"}}

	// Create matrix with multiple nodes
	multiNodeMatrix := model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{"nodename": "node-1"},
			Values: samples1,
		},
		&model.SampleStream{
			Metric: model.Metric{"nodename": "node-2"},
			Values: samples2,
		},
	}

	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("v1.Range")).Return(
		multiNodeMatrix, v1.Warnings{}, nil,
	).Times(6)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.NoError(err)
	s.NotNil(result)
	s.Len(result, 2)

	s.Contains(result, "node-1")
	s.Contains(result, "node-2")
	s.Equal(samples1, result["node-1"].CPU)
	s.Equal(samples2, result["node-2"].CPU)
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_UnknownNodeName() {
	samples := s.createTestSamples()
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}

	// Create matrix with missing nodename label
	matrixWithoutNodename := model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{}, // No nodename label
			Values: samples,
		},
	}

	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("v1.Range")).Return(
		matrixWithoutNodename, v1.Warnings{}, nil,
	).Times(6)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		filter,
	)

	s.NoError(err)
	s.NotNil(result)
	s.Len(result, 1)
	s.Contains(result, "unknown")
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_NilFilter() {
	samples := s.createTestSamples()

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		// Should not contain node name filters when filter is nil
		return !containsString(query, "nodename=")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	).Times(6)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		s.testStart,
		s.testEnd,
		s.testStep,
		nil, // nil filter
	)

	s.NoError(err)
	s.NotNil(result)
}

func (s *NodeMetricsQueryTestSuite) TestGetNodeMetrics_TimeAlignment() {
	// Test that start/end times are properly aligned to step boundaries
	unalignedStart := time.Date(2024, 1, 1, 12, 7, 23, 0, time.UTC)
	unalignedEnd := time.Date(2024, 1, 1, 13, 12, 47, 0, time.UTC)
	step := 5 * time.Minute

	samples := s.createTestSamples()
	filter := &NodeMetricsFilter{NodeName: []string{"node-1"}}

	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.MatchedBy(func(r v1.Range) bool {
		// Verify that times are aligned to step boundaries
		expectedStart := time.Date(2024, 1, 1, 12, 5, 0, 0, time.UTC)
		expectedEnd := time.Date(2024, 1, 1, 13, 10, 0, 0, time.UTC)

		return r.Start.Equal(expectedStart) && r.End.Equal(expectedEnd) && r.Step == step
	})).Return(
		s.createNodeSampleMatrix("node-1", samples), v1.Warnings{}, nil,
	).Times(6)

	result, err := s.client.GetNodeMetrics(
		s.ctx,
		unalignedStart,
		unalignedEnd,
		step,
		filter,
	)

	s.NoError(err)
	s.NotNil(result)
}

func (s *NodeMetricsQueryTestSuite) TestExtractNodeMetrics() {
	// Test the extractNodeMetrics helper function directly
	samples := s.createTestSamples()
	matrix := model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{"nodename": "test-node"},
			Values: samples,
		},
	}

	groupedMetrics := make(map[string]*NodeMetrics)

	extractNodeMetrics(matrix, groupedMetrics, func(metrics *NodeMetrics, samples []model.SamplePair) {
		metrics.CPU = samples
	})

	s.Len(groupedMetrics, 1)
	s.Contains(groupedMetrics, "test-node")
	s.Equal(samples, groupedMetrics["test-node"].CPU)
}

func (s *NodeMetricsQueryTestSuite) TestExtractNodeMetrics_NonMatrixResult() {
	// Test extractNodeMetrics with non-Matrix result
	vector := model.Vector{
		&model.Sample{
			Metric: model.Metric{"nodename": "test-node"},
			Value:  model.SampleValue(42.0),
		},
	}

	groupedMetrics := make(map[string]*NodeMetrics)

	extractNodeMetrics(vector, groupedMetrics, func(metrics *NodeMetrics, samples []model.SamplePair) {
		metrics.CPU = samples
	})

	// Should not add anything since it's not a Matrix
	s.Empty(groupedMetrics)
}

func TestNodeMetricsQueryTestSuite(t *testing.T) {
	suite.Run(t, new(NodeMetricsQueryTestSuite))
}
