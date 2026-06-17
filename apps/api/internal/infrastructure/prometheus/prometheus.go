package prometheus

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/unbindapp/unbind-api/config"
)

// PromAPIInterface is an interface that defines the methods we expect from the Prometheus API client, so we can generate mocks with mockery
type PromAPIInterface interface {
	Query(ctx context.Context, query string, ts time.Time, opts ...v1.Option) (model.Value, v1.Warnings, error)
	QueryRange(ctx context.Context, query string, r v1.Range, opts ...v1.Option) (model.Value, v1.Warnings, error)
}

type PrometheusClient struct {
	cfg *config.Config
	api PromAPIInterface
}

func NewPrometheusClient(cfg *config.Config) (*PrometheusClient, error) {
	client, err := api.NewClient(api.Config{
		Address: cfg.PrometheusEndpoint,
	})
	if err != nil {
		return nil, fmt.Errorf("error creating client: %w", err)
	}

	return &PrometheusClient{
		cfg: cfg,
		api: v1.NewAPI(client),
	}, nil
}
