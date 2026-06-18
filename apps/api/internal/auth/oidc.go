package auth

import (
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"

	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// OIDCHandler serves the discovery and JWKS documents that token-consuming clients
// use to validate our tokens.
type OIDCHandler struct {
	tokenManager *TokenManager
}

func NewOIDCHandler(tokenManager *TokenManager) *OIDCHandler {
	return &OIDCHandler{tokenManager: tokenManager}
}

type wellKnownConfig struct {
	Issuer                           string   `json:"issuer"`
	JWKSURI                          string   `json:"jwks_uri"`
	ResponseTypesSupported           []string `json:"response_types_supported"`
	SubjectTypesSupported            []string `json:"subject_types_supported"`
	IDTokenSigningAlgValuesSupported []string `json:"id_token_signing_alg_values_supported"`
	ScopesSupported                  []string `json:"scopes_supported"`
}

func (self *OIDCHandler) HandleOpenIDConfiguration(w http.ResponseWriter, r *http.Request) {
	issuer := self.tokenManager.Issuer()
	jwksURI, _ := utils.JoinURLPaths(issuer, ".well-known", "jwks.json")

	cfg := wellKnownConfig{
		Issuer:                           issuer,
		JWKSURI:                          jwksURI,
		ResponseTypesSupported:           []string{"none"},
		SubjectTypesSupported:            []string{"public"},
		IDTokenSigningAlgValuesSupported: []string{"RS256"},
		ScopesSupported:                  []string{"openid", "profile", "email", "groups", "offline_access"},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

type jwksResponse struct {
	Keys []jwk `json:"keys"`
}

type jwk struct {
	Kty string `json:"kty"`
	N   string `json:"n"`
	E   string `json:"e"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	Kid string `json:"kid"`
}

func (self *OIDCHandler) HandleJWKS(w http.ResponseWriter, r *http.Request) {
	pubKey := self.tokenManager.privateKey.PublicKey

	resp := jwksResponse{
		Keys: []jwk{
			{
				Kty: "RSA",
				N:   base64.RawURLEncoding.EncodeToString(pubKey.N.Bytes()),
				E:   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pubKey.E)).Bytes()),
				Alg: "RS256",
				Use: "sig",
				Kid: KeyID,
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
