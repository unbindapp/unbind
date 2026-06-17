package loki

import (
	"fmt"
	"net/http"
	"time"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

type LokiLogQuerier struct {
	cfg        *config.Config
	endpoint   string
	httpClient http.Client
}

func NewLokiLogger(cfg *config.Config) (*LokiLogQuerier, error) {
	if cfg.LokiEndpoint == "" {
		return nil, fmt.Errorf("LokiEndpoint cannot be empty")
	}

	// Construct endpoint
	reqURLStr, err := utils.JoinURLPaths(cfg.LokiEndpoint, "loki", "api", "v1", "tail")
	if err != nil {
		return nil, fmt.Errorf("unable to construct loki query URL: %v", err)
	}

	return &LokiLogQuerier{
		cfg:      cfg,
		endpoint: reqURLStr,
		httpClient: http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}
