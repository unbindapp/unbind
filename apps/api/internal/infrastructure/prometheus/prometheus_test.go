package prometheus

import (
	"context"
	"testing"
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	mocks_promapi "github.com/unbindapp/unbind-api/mocks/promapi"
)

type PrometheusTestSuite struct {
	suite.Suite
	client  *PrometheusClient
	mockAPI *mocks_promapi.PromAPIInterfaceMock
	ctx     context.Context
	cancel  context.CancelFunc
	testCfg *config.Config
}

func (s *PrometheusTestSuite) SetupTest() {
	s.ctx, s.cancel = context.WithTimeout(context.Background(), 5*time.Second)

	s.testCfg = &config.Config{
		PrometheusEndpoint: "http://prometheus:9090",
	}

	s.mockAPI = mocks_promapi.NewPromAPIInterfaceMock(s.T())

	s.client = &PrometheusClient{
		cfg: s.testCfg,
		api: s.mockAPI,
	}
}

func (s *PrometheusTestSuite) TearDownTest() {
	if s.cancel != nil {
		s.cancel()
	}
	s.mockAPI.AssertExpectations(s.T())
}

func (s *PrometheusTestSuite) TestNewPrometheusClient_Success() {
	cfg := &config.Config{
		PrometheusEndpoint: "http://prometheus:9090",
	}

	client, err := NewPrometheusClient(cfg)

	s.NoError(err)
	s.NotNil(client)
	s.Equal(cfg, client.cfg)
	s.NotNil(client.api)
}

func (s *PrometheusTestSuite) TestNewPrometheusClient_InvalidEndpoint() {
	cfg := &config.Config{
		PrometheusEndpoint: ":/invalid-url",
	}

	client, err := NewPrometheusClient(cfg)

	s.Error(err)
	s.Nil(client)
	s.Contains(err.Error(), "error creating client")
}

func (s *PrometheusTestSuite) TestNewPrometheusClient_EmptyEndpoint() {
	cfg := &config.Config{
		PrometheusEndpoint: "",
	}

	// Empty endpoint should still work - will use default
	client, err := NewPrometheusClient(cfg)

	s.NoError(err)
	s.NotNil(client)
}

func (s *PrometheusTestSuite) TestPrometheusClient_ConfigAccess() {
	s.Equal(s.testCfg, s.client.cfg)
	s.Equal("http://prometheus:9090", s.client.cfg.PrometheusEndpoint)
}

func (s *PrometheusTestSuite) TestPrometheusClient_APIAccess() {
	s.NotNil(s.client.api)

	// Test that we can call methods on the API interface
	s.mockAPI.On("Query", s.ctx, "up", mock.AnythingOfType("time.Time")).Return(
		model.Vector{}, v1.Warnings{}, nil,
	)

	result, warnings, err := s.client.api.Query(s.ctx, "up", time.Now())

	s.NoError(err)
	s.Empty(warnings)
	s.NotNil(result)
}

func (s *PrometheusTestSuite) TestPrometheusClient_InterfaceImplementation() {
	// Verify that PrometheusClient properly uses the PromAPIInterface
	s.Implements((*PromAPIInterface)(nil), s.client.api)
}

func (s *PrometheusTestSuite) TestPrometheusClient_ContextTimeout() {
	// Test that context timeout is respected
	shortCtx, cancel := context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()

	time.Sleep(2 * time.Nanosecond) // Ensure context is expired

	s.mockAPI.On("Query", shortCtx, "up", mock.AnythingOfType("time.Time")).Return(
		nil, v1.Warnings{}, context.DeadlineExceeded,
	)

	_, _, err := s.client.api.Query(shortCtx, "up", time.Now())

	s.Error(err)
	s.Equal(context.DeadlineExceeded, err)
}

func (s *PrometheusTestSuite) TestPrometheusEndpointVariations() {
	testCases := []struct {
		name      string
		endpoint  string
		expectErr bool
	}{
		{
			name:      "HTTP endpoint",
			endpoint:  "http://prometheus:9090",
			expectErr: false,
		},
		{
			name:      "HTTPS endpoint",
			endpoint:  "https://prometheus.example.com:9090",
			expectErr: false,
		},
		{
			name:      "Localhost endpoint",
			endpoint:  "http://localhost:9090",
			expectErr: false,
		},
		{
			name:      "IP address endpoint",
			endpoint:  "http://192.168.1.100:9090",
			expectErr: false,
		},
		{
			name:      "Invalid scheme",
			endpoint:  "ftp://prometheus:9090",
			expectErr: false, // Prometheus client might accept this
		},
		{
			name:      "Malformed URL",
			endpoint:  "://invalid",
			expectErr: true,
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			cfg := &config.Config{
				PrometheusEndpoint: tc.endpoint,
			}

			client, err := NewPrometheusClient(cfg)

			if tc.expectErr {
				s.Error(err, "Expected error for endpoint: %s", tc.endpoint)
				s.Nil(client)
			} else {
				s.NoError(err, "Unexpected error for endpoint: %s", tc.endpoint)
				s.NotNil(client)
				s.Equal(tc.endpoint, client.cfg.PrometheusEndpoint)
			}
		})
	}
}

func TestPrometheusTestSuite(t *testing.T) {
	suite.Run(t, new(PrometheusTestSuite))
}
