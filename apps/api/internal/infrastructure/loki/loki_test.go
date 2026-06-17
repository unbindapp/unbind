package loki

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

type LokiTestSuite struct {
	suite.Suite
	cfg *config.Config
}

func (suite *LokiTestSuite) SetupTest() {
	suite.cfg = &config.Config{
		LokiEndpoint: "http://loki.test:3100",
	}
}

func (suite *LokiTestSuite) TearDownTest() {
	suite.cfg = nil
}

func (suite *LokiTestSuite) TestNewLokiLogger_Success() {
	querier, err := NewLokiLogger(suite.cfg)

	suite.NoError(err)
	suite.NotNil(querier)
	suite.Equal(suite.cfg, querier.cfg)
	suite.Equal("http://loki.test:3100/loki/api/v1/tail", querier.endpoint)
	suite.Equal(10, int(querier.httpClient.Timeout.Seconds()))
}

func (suite *LokiTestSuite) TestNewLokiLogger_InvalidURL() {
	suite.cfg.LokiEndpoint = "://invalid-url"

	querier, err := NewLokiLogger(suite.cfg)

	suite.Error(err)
	suite.Nil(querier)
	suite.Contains(err.Error(), "unable to construct loki query URL")
}

func (suite *LokiTestSuite) TestNewLokiLogger_EmptyURL() {
	suite.cfg.LokiEndpoint = ""

	querier, err := NewLokiLogger(suite.cfg)

	suite.Error(err)
	suite.Nil(querier)
}

func (suite *LokiTestSuite) TestNewLokiLogger_URLWithPaths() {
	suite.cfg.LokiEndpoint = "http://loki.test:3100/custom/path"

	querier, err := NewLokiLogger(suite.cfg)

	suite.NoError(err)
	suite.NotNil(querier)
	suite.Equal("http://loki.test:3100/custom/path/loki/api/v1/tail", querier.endpoint)
}

func (suite *LokiTestSuite) TestJoinURLPathsEdgeCase() {
	// Test edge case for utils.JoinURLPaths function
	baseURL := "http://test.com"
	result, err := utils.JoinURLPaths(baseURL, "path1", "path2", "path3")

	suite.NoError(err)
	suite.Equal("http://test.com/path1/path2/path3", result)
}

func TestLokiTestSuite(t *testing.T) {
	suite.Run(t, new(LokiTestSuite))
}
