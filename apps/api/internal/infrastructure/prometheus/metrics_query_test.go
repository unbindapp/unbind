package prometheus

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	mocks_promapi "github.com/unbindapp/unbind-api/mocks/promapi"
)

type MetricsQueryTestSuite struct {
	suite.Suite
	client     *PrometheusClient
	mockAPI    *mocks_promapi.PromAPIInterfaceMock
	ctx        context.Context
	cancel     context.CancelFunc
	testStart  time.Time
	testEnd    time.Time
	testStep   time.Duration
	testFilter *MetricsFilter
}

func (s *MetricsQueryTestSuite) SetupTest() {
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

	// Setup test filter
	s.testFilter = &MetricsFilter{
		TeamID:        uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		ProjectID:     uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		EnvironmentID: uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		ServiceIDs:    []uuid.UUID{uuid.MustParse("44444444-4444-4444-4444-444444444444")},
	}
}

func (s *MetricsQueryTestSuite) TearDownTest() {
	if s.cancel != nil {
		s.cancel()
	}
	s.mockAPI.AssertExpectations(s.T())
}

func (s *MetricsQueryTestSuite) createSampleMatrix(serviceName string, values []model.SamplePair) model.Matrix {
	return model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{
				"label_unbind_service": model.LabelValue(serviceName),
			},
			Values: values,
		},
	}
}

func (s *MetricsQueryTestSuite) createTestSamples() []model.SamplePair {
	samples := make([]model.SamplePair, 5)
	for i := 0; i < 5; i++ {
		timestamp := s.testStart.Add(time.Duration(i) * s.testStep)
		samples[i] = model.SamplePair{
			Timestamp: model.Time(timestamp.Unix() * 1000),
			Value:     model.SampleValue(float64(i) * 10.5),
		}
	}
	return samples
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_Success() {
	samples := s.createTestSamples()

	// Mock all four metric queries
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_cpu_usage_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_memory_working_set_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_network_receive_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "kubelet_volume_stats_used_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		s.testStart,
		s.testEnd,
		s.testStep,
		s.testFilter,
	)

	s.NoError(err)
	s.NotNil(result)
	s.Len(result, 1)

	serviceMetrics := result["test-service"]
	s.NotNil(serviceMetrics)
	s.Equal(samples, serviceMetrics.CPU)
	s.Equal(samples, serviceMetrics.RAM)
	s.Equal(samples, serviceMetrics.Network)
	s.Equal(samples, serviceMetrics.Disk)
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_CPUQueryError() {
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_cpu_usage_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("CPU query failed"),
	)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		s.testStart,
		s.testEnd,
		s.testStep,
		s.testFilter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying CPU metrics")
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_RAMQueryError() {
	samples := s.createTestSamples()

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_cpu_usage_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_memory_working_set_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("RAM query failed"),
	)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		s.testStart,
		s.testEnd,
		s.testStep,
		s.testFilter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying RAM metrics")
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_NetworkQueryError() {
	samples := s.createTestSamples()

	// Mock successful CPU and RAM queries
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_cpu_usage_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_memory_working_set_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	// Mock failed network query
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_network_receive_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("Network query failed"),
	)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		s.testStart,
		s.testEnd,
		s.testStep,
		s.testFilter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying network metrics")
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_DiskQueryError() {
	samples := s.createTestSamples()

	// Mock first three successful queries
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_cpu_usage_seconds_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_memory_working_set_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "container_network_receive_bytes_total")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	)

	// Mock failed disk query
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "kubelet_volume_stats_used_bytes")
	}), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("Disk query failed"),
	)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		s.testStart,
		s.testEnd,
		s.testStep,
		s.testFilter,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "error querying disk metrics")
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_EmptyResults() {
	// Mock all queries returning empty results
	emptyMatrix := model.Matrix{}

	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("v1.Range")).Return(
		emptyMatrix, v1.Warnings{}, nil,
	).Times(4)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		s.testStart,
		s.testEnd,
		s.testStep,
		s.testFilter,
	)

	s.NoError(err)
	s.NotNil(result)
	s.Empty(result)
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_MultipleServices() {
	samples1 := s.createTestSamples()
	samples2 := make([]model.SamplePair, 3)
	for i := 0; i < 3; i++ {
		timestamp := s.testStart.Add(time.Duration(i) * s.testStep)
		samples2[i] = model.SamplePair{
			Timestamp: model.Time(timestamp.Unix() * 1000),
			Value:     model.SampleValue(float64(i) * 5.25),
		}
	}

	// Create matrix with multiple services
	multiServiceMatrix := model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{"label_unbind_service": "service-1"},
			Values: samples1,
		},
		&model.SampleStream{
			Metric: model.Metric{"label_unbind_service": "service-2"},
			Values: samples2,
		},
	}

	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("v1.Range")).Return(
		multiServiceMatrix, v1.Warnings{}, nil,
	).Times(4)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		s.testStart,
		s.testEnd,
		s.testStep,
		s.testFilter,
	)

	s.NoError(err)
	s.NotNil(result)
	s.Len(result, 2)

	s.Contains(result, "service-1")
	s.Contains(result, "service-2")
	s.Equal(samples1, result["service-1"].CPU)
	s.Equal(samples2, result["service-2"].CPU)
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_DifferentSumByOptions() {
	samples := s.createTestSamples()

	testCases := []struct {
		name          string
		sumBy         MetricsFilterSumBy
		expectedLabel string
	}{
		{
			name:          "Sum by project",
			sumBy:         MetricsFilterSumByProject,
			expectedLabel: "label_unbind_project",
		},
		{
			name:          "Sum by environment",
			sumBy:         MetricsFilterSumByEnvironment,
			expectedLabel: "label_unbind_environment",
		},
		{
			name:          "Sum by service",
			sumBy:         MetricsFilterSumByService,
			expectedLabel: "label_unbind_service",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			// Create matrix with expected label
			testMatrix := model.Matrix{
				&model.SampleStream{
					Metric: model.Metric{model.LabelName(tc.expectedLabel): "test-value"},
					Values: samples,
				},
			}

			s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
				return containsString(query, fmt.Sprintf("sum by (%s)", tc.expectedLabel))
			}), mock.AnythingOfType("v1.Range")).Return(
				testMatrix, v1.Warnings{}, nil,
			).Times(4)

			result, err := s.client.GetResourceMetrics(
				s.ctx,
				tc.sumBy,
				s.testStart,
				s.testEnd,
				s.testStep,
				s.testFilter,
			)

			s.NoError(err)
			s.NotNil(result)
			s.Len(result, 1)
			s.Contains(result, "test-value")
		})
	}
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_TimeAlignment() {
	// Test that start/end times are properly aligned to step boundaries
	unalignedStart := time.Date(2024, 1, 1, 12, 7, 23, 0, time.UTC)
	unalignedEnd := time.Date(2024, 1, 1, 13, 12, 47, 0, time.UTC)
	step := 5 * time.Minute

	samples := s.createTestSamples()

	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.MatchedBy(func(r v1.Range) bool {
		// Verify that times are aligned to step boundaries
		expectedStart := time.Date(2024, 1, 1, 12, 5, 0, 0, time.UTC)
		expectedEnd := time.Date(2024, 1, 1, 13, 10, 0, 0, time.UTC)

		return r.Start.Equal(expectedStart) && r.End.Equal(expectedEnd) && r.Step == step
	})).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	).Times(4)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		unalignedStart,
		unalignedEnd,
		step,
		s.testFilter,
	)

	s.NoError(err)
	s.NotNil(result)
}

func (s *MetricsQueryTestSuite) TestGetResourceMetrics_NilFilter() {
	samples := s.createTestSamples()

	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		// Should not contain label selector filters when filter is nil (ends with kube_pod_labels not kube_pod_labels{...})
		return containsString(query, "kube_pod_labels\n\t)")
	}), mock.AnythingOfType("v1.Range")).Return(
		s.createSampleMatrix("test-service", samples), v1.Warnings{}, nil,
	).Times(4)

	result, err := s.client.GetResourceMetrics(
		s.ctx,
		MetricsFilterSumByService,
		s.testStart,
		s.testEnd,
		s.testStep,
		nil, // nil filter
	)

	s.NoError(err)
	s.NotNil(result)
}

func (s *MetricsQueryTestSuite) TestCalculateNetworkWindow() {
	testCases := []struct {
		name     string
		step     time.Duration
		expected string
	}{
		{
			name:     "Small step - use minimum 1m",
			step:     30 * time.Second,
			expected: "1m",
		},
		{
			name:     "Medium step - use 2x step",
			step:     2 * time.Minute,
			expected: "4m",
		},
		{
			name:     "Large step - use 2x step in minutes",
			step:     15 * time.Minute,
			expected: "30m",
		},
		{
			name:     "Hour step - use hours format",
			step:     30 * time.Minute,
			expected: "1h",
		},
		{
			name:     "Multiple hours",
			step:     90 * time.Minute,
			expected: "3h",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			result := calculateNetworkWindow(tc.step)
			s.Equal(tc.expected, result)
		})
	}
}

func (s *MetricsQueryTestSuite) TestAlignTimeToStep() {
	testCases := []struct {
		name     string
		input    time.Time
		step     time.Duration
		expected time.Time
	}{
		{
			name:     "Already aligned",
			input:    time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
			step:     5 * time.Minute,
			expected: time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		},
		{
			name:     "Round down to nearest 5 minutes",
			input:    time.Date(2024, 1, 1, 12, 7, 23, 0, time.UTC),
			step:     5 * time.Minute,
			expected: time.Date(2024, 1, 1, 12, 5, 0, 0, time.UTC),
		},
		{
			name:     "Round down to nearest hour",
			input:    time.Date(2024, 1, 1, 12, 45, 30, 0, time.UTC),
			step:     1 * time.Hour,
			expected: time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		},
		{
			name:     "Round down to nearest 15 minutes",
			input:    time.Date(2024, 1, 1, 12, 23, 45, 0, time.UTC),
			step:     15 * time.Minute,
			expected: time.Date(2024, 1, 1, 12, 15, 0, 0, time.UTC),
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			result := alignTimeToStep(tc.input, tc.step)
			s.Equal(tc.expected, result)
		})
	}
}

// Helper function to check if a string contains a substring
func containsString(s, substr string) bool {
	return len(s) >= len(substr) &&
		(len(substr) == 0 || stringContains(s, substr))
}

func stringContains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestMetricsQueryTestSuite(t *testing.T) {
	suite.Run(t, new(MetricsQueryTestSuite))
}
