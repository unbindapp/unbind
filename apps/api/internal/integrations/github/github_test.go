package github

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-github/v69/github"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
)

type GithubClientTestSuite struct {
	suite.Suite
	cfg    *config.Config
	client *GithubClient
	ctx    context.Context
}

func (suite *GithubClientTestSuite) SetupTest() {
	suite.ctx = context.Background()
	suite.cfg = &config.Config{
		ExternalAPIURL:   "https://api.test.com",
		GithubWebhookURL: "https://webhook.test.com",
		UnbindSuffix:     "test",
	}
}

func (suite *GithubClientTestSuite) TestNewGithubClient_WithGitHubCom() {
	// Test with standard GitHub.com URL
	client := NewGithubClient("https://github.com", suite.cfg)

	suite.NotNil(client)
	suite.Equal(suite.cfg, client.cfg)
	suite.NotNil(client.client)
}

func (suite *GithubClientTestSuite) TestNewGithubClient_WithEmptyURL() {
	// Test with empty URL (should default to GitHub.com)
	client := NewGithubClient("", suite.cfg)

	suite.NotNil(client)
	suite.Equal(suite.cfg, client.cfg)
	suite.NotNil(client.client)
}

func (suite *GithubClientTestSuite) TestNewGithubClient_WithEnterpriseURL() {
	// Test with GitHub Enterprise URL
	enterpriseURL := "https://github.enterprise.com"
	client := NewGithubClient(enterpriseURL, suite.cfg)

	suite.NotNil(client)
	suite.Equal(suite.cfg, client.cfg)
	suite.NotNil(client.client)
}

func (suite *GithubClientTestSuite) TestNewGithubClient_WithEnterpriseURLWithoutTrailingSlash() {
	// Test with GitHub Enterprise URL without trailing slash
	enterpriseURL := "https://github.enterprise.com"
	client := NewGithubClient(enterpriseURL, suite.cfg)

	suite.NotNil(client)
	suite.Equal(suite.cfg, client.cfg)
	suite.NotNil(client.client)
}

func (suite *GithubClientTestSuite) TestGetInstallationToken_Success() {
	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify the request
		suite.Equal("POST", r.Method)
		suite.Contains(r.URL.Path, "/app/installations/123/access_tokens")

		// Check for Bearer token in Authorization header
		authHeader := r.Header.Get("Authorization")
		suite.Contains(authHeader, "Bearer ")

		// Return mock token response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"token": "ghs_test_token", "expires_at": "2024-01-01T00:00:00Z"}`))
	}))
	defer server.Close()

	// Create client with mock server
	httpClient := &http.Client{}
	githubClient := github.NewClient(httpClient)
	githubClient, _ = githubClient.WithEnterpriseURLs(server.URL+"/api/v3/", server.URL+"/api/uploads/")
	client := &GithubClient{
		cfg:    suite.cfg,
		client: githubClient,
	}

	// Test private key (real RSA key for testing)
	testPrivateKey := `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA07OTGDkC1sc6yQPfANNkAoyhy3H4YFyihlJ+aCgt2aNglBkQ
ymVA2LFyNJtqAx/bCeH4G4bf87yuK8uCU/7yhx8jR/63EPRGYcO5WsJfZ/YbB+zW
6lcQ7Jt2I7QYSRBnloYfGsQZEfY7XYVcr+aRM1IvCzcM53IbJ7PgmKv3HOeaRSZ1
0B+vGvA5YcprRKKO3kI4TTvKc2af9ocfQTClD+YUl97so4dNX/yGBDeT352Gl/wI
00KyeFejYJrpdIjcFQ9lLdLRpQETpvDYE9CoaAZcknbZBY4l2s5iskpUWTNr+yn4
RxJB1ZK+QbCWiJp/TjwQer4EJhXbpMoI1YXZpwIDAQABAoIBAQC7eyG+ZubbvI6T
7Ii2m37LPy4eFO2osQEBwdbOeR65yhVCsrwK8gauoN8KNcR5xeFebC8keZqlqSf6
Av2FU5gHEA1Xufz318zo0cO5279QO0SPDTD7UWXclITYc6q6Mfv68wZi1t146b6D
QRLneGKIt7SP0w3rfkMMMyGpM0nh3qFO+1iZELrveHPRMzLiUzHpLtVTbKcoAWoT
E2UzrRrizUE8M8137jeD/7f4m6h98EIFvB1e/lETztfhmtokKMI654ospo7t/5WL
KSdIl/VFm/WYB0m+16wwx1KGSVW/pFzED4xk7r/ycZvGIvDNUZVNQyzjCNbT4ZNA
Rsl5ISHhAoGBAPDRkFWEBCsuaQWMbkAjRhDpbhweXith5wy1mTLJAsBPT//Z+mAg
Lv/nMLL9AKuxiK87I1U7LG65mJwucQNT5vZuyFW0GUvHZFoOZE2Z96Pr+nSksvZg
Wli4dn0eUyGr4OpAOKnSk6NUjTV+WM0GhNv7XXxAdgENXNn5u8sJ/RexAoGBAOEM
GwR1cJ0IrSOD0SbtzGKE9BYak3SEw5Oata83Sk0c5TqO5S5bN3QGpJg1VxMd5RA3
4PVIuEzrSF1wWmSHS3ubHEHnVJ0l4Z/Gql+xKtEgdYW3o/Oybtgwqt4V8cpF2kUt
MeNGNO2RNPehXPhauZp0R4QvPyI6u5hXuwO8VzTXAoGAFD8qSWZOC2tdfQ/vfQj6
LRXTIh4TgMY8bL8f4DsyNgT1Due+uzI5gV5oo8PNuKG2gjUQpWvSMoT8JbVp3wPA
2Vs7EKmRruNWtpObL0MQpQGEDyaBvWEgd3Ea1S4lgyE2SbuYh/6iVwsWzDaRNLul
k/EwTPAGe9QpyFHMzidK1iECgYB14Pll5H4QQzMtnyY21ehw0mNoEJOcPM6UyjzQ
go2QxsnrWl4BYhYx2Cju8UGi6c3KKPrUgDrJT5SgHPG8JoILRLwQaTOQ/P6pyk4D
wbFDyVTFreNbCuO0qglWOvhjkyM5iOrQuT2QErdD3mnsTNlbZfzv6C+RpmIM8icr
VcP4EQKBgQDPMOy+l87mCGHjeTRNFqZx4VL7OLfCx98Qkj9Mbod9Py4CUjKZE7w6
hNjzSM0VFUAwfsi+3suz2k/mft6DNxOZKyFJsen+QE38/VNH7FkNZZ1BjuorOk9i
OA1q6/kbt7BaP4cvSZglhFWqI4RKezuQBhAVZv7kQU10SJ+A9f/E+Q==
-----END RSA PRIVATE KEY-----`

	token, err := client.GetInstallationToken(suite.ctx, 12345, 123, testPrivateKey)

	suite.NoError(err)
	suite.Equal("ghs_test_token", token)
}

func (suite *GithubClientTestSuite) TestGetInstallationToken_InvalidPrivateKey() {
	client := NewGithubClient("https://github.com", suite.cfg)

	token, err := client.GetInstallationToken(suite.ctx, 12345, 123, "invalid-key")

	suite.Error(err)
	suite.Empty(token)
	suite.Contains(err.Error(), "failed to decode private key")
}

func (suite *GithubClientTestSuite) TestGetInstallationToken_HTTPError() {
	// Create a mock server that returns an error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"message": "Unauthorized"}`))
	}))
	defer server.Close()

	// Create client with mock server
	httpClient := &http.Client{}
	githubClient := github.NewClient(httpClient)
	githubClient, _ = githubClient.WithEnterpriseURLs(server.URL+"/api/v3/", server.URL+"/api/uploads/")
	client := &GithubClient{
		cfg:    suite.cfg,
		client: githubClient,
	}

	// Test private key (real RSA key for testing)
	testPrivateKey := `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA07OTGDkC1sc6yQPfANNkAoyhy3H4YFyihlJ+aCgt2aNglBkQ
ymVA2LFyNJtqAx/bCeH4G4bf87yuK8uCU/7yhx8jR/63EPRGYcO5WsJfZ/YbB+zW
6lcQ7Jt2I7QYSRBnloYfGsQZEfY7XYVcr+aRM1IvCzcM53IbJ7PgmKv3HOeaRSZ1
0B+vGvA5YcprRKKO3kI4TTvKc2af9ocfQTClD+YUl97so4dNX/yGBDeT352Gl/wI
00KyeFejYJrpdIjcFQ9lLdLRpQETpvDYE9CoaAZcknbZBY4l2s5iskpUWTNr+yn4
RxJB1ZK+QbCWiJp/TjwQer4EJhXbpMoI1YXZpwIDAQABAoIBAQC7eyG+ZubbvI6T
7Ii2m37LPy4eFO2osQEBwdbOeR65yhVCsrwK8gauoN8KNcR5xeFebC8keZqlqSf6
Av2FU5gHEA1Xufz318zo0cO5279QO0SPDTD7UWXclITYc6q6Mfv68wZi1t146b6D
QRLneGKIt7SP0w3rfkMMMyGpM0nh3qFO+1iZELrveHPRMzLiUzHpLtVTbKcoAWoT
E2UzrRrizUE8M8137jeD/7f4m6h98EIFvB1e/lETztfhmtokKMI654ospo7t/5WL
KSdIl/VFm/WYB0m+16wwx1KGSVW/pFzED4xk7r/ycZvGIvDNUZVNQyzjCNbT4ZNA
Rsl5ISHhAoGBAPDRkFWEBCsuaQWMbkAjRhDpbhweXith5wy1mTLJAsBPT//Z+mAg
Lv/nMLL9AKuxiK87I1U7LG65mJwucQNT5vZuyFW0GUvHZFoOZE2Z96Pr+nSksvZg
Wli4dn0eUyGr4OpAOKnSk6NUjTV+WM0GhNv7XXxAdgENXNn5u8sJ/RexAoGBAOEM
GwR1cJ0IrSOD0SbtzGKE9BYak3SEw5Oata83Sk0c5TqO5S5bN3QGpJg1VxMd5RA3
4PVIuEzrSF1wWmSHS3ubHEHnVJ0l4Z/Gql+xKtEgdYW3o/Oybtgwqt4V8cpF2kUt
MeNGNO2RNPehXPhauZp0R4QvPyI6u5hXuwO8VzTXAoGAFD8qSWZOC2tdfQ/vfQj6
LRXTIh4TgMY8bL8f4DsyNgT1Due+uzI5gV5oo8PNuKG2gjUQpWvSMoT8JbVp3wPA
2Vs7EKmRruNWtpObL0MQpQGEDyaBvWEgd3Ea1S4lgyE2SbuYh/6iVwsWzDaRNLul
k/EwTPAGe9QpyFHMzidK1iECgYB14Pll5H4QQzMtnyY21ehw0mNoEJOcPM6UyjzQ
go2QxsnrWl4BYhYx2Cju8UGi6c3KKPrUgDrJT5SgHPG8JoILRLwQaTOQ/P6pyk4D
wbFDyVTFreNbCuO0qglWOvhjkyM5iOrQuT2QErdD3mnsTNlbZfzv6C+RpmIM8icr
VcP4EQKBgQDPMOy+l87mCGHjeTRNFqZx4VL7OLfCx98Qkj9Mbod9Py4CUjKZE7w6
hNjzSM0VFUAwfsi+3suz2k/mft6DNxOZKyFJsen+QE38/VNH7FkNZZ1BjuorOk9i
OA1q6/kbt7BaP4cvSZglhFWqI4RKezuQBhAVZv7kQU10SJ+A9f/E+Q==
-----END RSA PRIVATE KEY-----`

	token, err := client.GetInstallationToken(suite.ctx, 12345, 123, testPrivateKey)

	suite.Error(err)
	suite.Empty(token)
	suite.Contains(err.Error(), "failed to create installation token")
}

func (suite *GithubClientTestSuite) TestGetAuthenticatedClient_Success() {
	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return mock token response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"token": "ghs_test_token", "expires_at": "2024-01-01T00:00:00Z"}`))
	}))
	defer server.Close()

	// Create client with mock server
	httpClient := &http.Client{}
	githubClient := github.NewClient(httpClient)
	githubClient, _ = githubClient.WithEnterpriseURLs(server.URL+"/api/v3/", server.URL+"/api/uploads/")
	client := &GithubClient{
		cfg:    suite.cfg,
		client: githubClient,
	}

	// Test private key (real RSA key for testing)
	testPrivateKey := `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA07OTGDkC1sc6yQPfANNkAoyhy3H4YFyihlJ+aCgt2aNglBkQ
ymVA2LFyNJtqAx/bCeH4G4bf87yuK8uCU/7yhx8jR/63EPRGYcO5WsJfZ/YbB+zW
6lcQ7Jt2I7QYSRBnloYfGsQZEfY7XYVcr+aRM1IvCzcM53IbJ7PgmKv3HOeaRSZ1
0B+vGvA5YcprRKKO3kI4TTvKc2af9ocfQTClD+YUl97so4dNX/yGBDeT352Gl/wI
00KyeFejYJrpdIjcFQ9lLdLRpQETpvDYE9CoaAZcknbZBY4l2s5iskpUWTNr+yn4
RxJB1ZK+QbCWiJp/TjwQer4EJhXbpMoI1YXZpwIDAQABAoIBAQC7eyG+ZubbvI6T
7Ii2m37LPy4eFO2osQEBwdbOeR65yhVCsrwK8gauoN8KNcR5xeFebC8keZqlqSf6
Av2FU5gHEA1Xufz318zo0cO5279QO0SPDTD7UWXclITYc6q6Mfv68wZi1t146b6D
QRLneGKIt7SP0w3rfkMMMyGpM0nh3qFO+1iZELrveHPRMzLiUzHpLtVTbKcoAWoT
E2UzrRrizUE8M8137jeD/7f4m6h98EIFvB1e/lETztfhmtokKMI654ospo7t/5WL
KSdIl/VFm/WYB0m+16wwx1KGSVW/pFzED4xk7r/ycZvGIvDNUZVNQyzjCNbT4ZNA
Rsl5ISHhAoGBAPDRkFWEBCsuaQWMbkAjRhDpbhweXith5wy1mTLJAsBPT//Z+mAg
Lv/nMLL9AKuxiK87I1U7LG65mJwucQNT5vZuyFW0GUvHZFoOZE2Z96Pr+nSksvZg
Wli4dn0eUyGr4OpAOKnSk6NUjTV+WM0GhNv7XXxAdgENXNn5u8sJ/RexAoGBAOEM
GwR1cJ0IrSOD0SbtzGKE9BYak3SEw5Oata83Sk0c5TqO5S5bN3QGpJg1VxMd5RA3
4PVIuEzrSF1wWmSHS3ubHEHnVJ0l4Z/Gql+xKtEgdYW3o/Oybtgwqt4V8cpF2kUt
MeNGNO2RNPehXPhauZp0R4QvPyI6u5hXuwO8VzTXAoGAFD8qSWZOC2tdfQ/vfQj6
LRXTIh4TgMY8bL8f4DsyNgT1Due+uzI5gV5oo8PNuKG2gjUQpWvSMoT8JbVp3wPA
2Vs7EKmRruNWtpObL0MQpQGEDyaBvWEgd3Ea1S4lgyE2SbuYh/6iVwsWzDaRNLul
k/EwTPAGe9QpyFHMzidK1iECgYB14Pll5H4QQzMtnyY21ehw0mNoEJOcPM6UyjzQ
go2QxsnrWl4BYhYx2Cju8UGi6c3KKPrUgDrJT5SgHPG8JoILRLwQaTOQ/P6pyk4D
wbFDyVTFreNbCuO0qglWOvhjkyM5iOrQuT2QErdD3mnsTNlbZfzv6C+RpmIM8icr
VcP4EQKBgQDPMOy+l87mCGHjeTRNFqZx4VL7OLfCx98Qkj9Mbod9Py4CUjKZE7w6
hNjzSM0VFUAwfsi+3suz2k/mft6DNxOZKyFJsen+QE38/VNH7FkNZZ1BjuorOk9i
OA1q6/kbt7BaP4cvSZglhFWqI4RKezuQBhAVZv7kQU10SJ+A9f/E+Q==
-----END RSA PRIVATE KEY-----`

	authenticatedClient, err := client.GetAuthenticatedClient(suite.ctx, 12345, 123, testPrivateKey)

	suite.NoError(err)
	suite.NotNil(authenticatedClient)
}

func (suite *GithubClientTestSuite) TestGetAuthenticatedClient_TokenError() {
	client := NewGithubClient("https://github.com", suite.cfg)

	authenticatedClient, err := client.GetAuthenticatedClient(suite.ctx, 12345, 123, "invalid-key")

	suite.Error(err)
	suite.Nil(authenticatedClient)
}

func TestGithubClientSuite(t *testing.T) {
	suite.Run(t, new(GithubClientTestSuite))
}
