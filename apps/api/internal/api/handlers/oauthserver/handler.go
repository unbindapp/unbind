// Package oauthserver_handler serves the OAuth endpoints MCP clients talk to.
// They are plain net/http rather than huma: the token endpoint speaks RFC 6749
// form bodies and error JSON, and authorize answers with redirects.
package oauthserver_handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/oauthex"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
	oauthserver_service "github.com/unbindapp/unbind-api/internal/services/oauthserver"
)

const (
	registerBodyLimit = 8 << 10
	tokenBodyLimit    = 8 << 10
	rateWindow        = time.Minute
	registerPerMinute = 10
	authorizePerMin   = 30
	tokenPerMinute    = 60
)

type Handler struct {
	svc    *oauthserver_service.OAuthServerService
	issuer string
}

func NewHandler(svc *oauthserver_service.OAuthServerService) *Handler {
	return &Handler{svc: svc, issuer: svc.Issuer()}
}

func (self *Handler) Mount(r chi.Router, limiter *middleware.RateLimiter) {
	r.Get("/.well-known/oauth-authorization-server", self.Metadata)
	r.Method(http.MethodGet, "/.well-known/oauth-protected-resource", auth.ProtectedResourceMetadataHandler(&oauthex.ProtectedResourceMetadata{
		Resource:               self.svc.Resource(),
		AuthorizationServers:   []string{self.issuer},
		BearerMethodsSupported: []string{"header"},
	}))
	r.With(limiter.Limit("register", registerPerMinute, rateWindow)).Post("/oauth/register", self.Register)
	r.With(limiter.Limit("authorize", authorizePerMin, rateWindow)).Get("/oauth/authorize", self.Authorize)
	r.With(limiter.Limit("token", tokenPerMinute, rateWindow)).Post("/oauth/token", self.Token)
}

func (self *Handler) Metadata(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, oauthserver.NewAuthorizationServerMetadata(self.issuer))
}

func (self *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var reg oauthserver.ClientRegistration
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, registerBodyLimit)).Decode(&reg); err != nil {
		oauthserver.WriteJSON(w, oauthserver.InvalidClientMetadata("body must be a json client metadata object"))
		return
	}
	resp, err := self.svc.RegisterClient(r.Context(), &reg)
	if err != nil {
		self.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (self *Handler) Authorize(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	req := &oauthserver_service.AuthorizeRequest{
		ResponseType:        q.Get("response_type"),
		ClientID:            q.Get("client_id"),
		RedirectURI:         q.Get("redirect_uri"),
		State:               q.Get("state"),
		CodeChallenge:       q.Get("code_challenge"),
		CodeChallengeMethod: q.Get("code_challenge_method"),
		Resource:            q.Get("resource"),
		Scope:               q.Get("scope"),
	}
	w.Header().Set("Cache-Control", "no-store")
	if _, err := self.svc.ValidateAuthorize(r.Context(), req); err != nil {
		var oauthErr *oauthserver.Error
		if errors.As(err, &oauthErr) && oauthErr.Redirectable {
			http.Redirect(w, r, self.svc.ErrorRedirect(req.RedirectURI, req.State, oauthErr), http.StatusFound)
			return
		}
		self.writeError(w, err)
		return
	}

	consent := url.Values{
		"response_type":         {req.ResponseType},
		"client_id":             {req.ClientID},
		"redirect_uri":          {req.RedirectURI},
		"code_challenge":        {req.CodeChallenge},
		"code_challenge_method": {req.CodeChallengeMethod},
		"resource":              {req.Resource},
	}
	if req.State != "" {
		consent.Set("state", req.State)
	}
	if req.Scope != "" {
		consent.Set("scope", req.Scope)
	}
	http.Redirect(w, r, oauthserver.ConsentURL(self.issuer)+"?"+consent.Encode(), http.StatusFound)
}

func (self *Handler) Token(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, tokenBodyLimit)
	if err := r.ParseForm(); err != nil {
		oauthserver.WriteJSON(w, oauthserver.InvalidRequest("body must be application/x-www-form-urlencoded"))
		return
	}
	var (
		resp *oauthserver_service.TokenResponse
		err  error
	)
	switch r.PostForm.Get("grant_type") {
	case "authorization_code":
		resp, err = self.svc.ExchangeCode(r.Context(), &oauthserver_service.CodeExchangeInput{
			ClientID:     r.PostForm.Get("client_id"),
			Code:         r.PostForm.Get("code"),
			RedirectURI:  r.PostForm.Get("redirect_uri"),
			CodeVerifier: r.PostForm.Get("code_verifier"),
			Resource:     r.PostForm.Get("resource"),
		})
	case "refresh_token":
		resp, err = self.svc.Refresh(r.Context(), &oauthserver_service.RefreshInput{
			ClientID:     r.PostForm.Get("client_id"),
			RefreshToken: r.PostForm.Get("refresh_token"),
		})
	default:
		err = oauthserver.UnsupportedGrantType()
	}
	if err != nil {
		self.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (self *Handler) writeError(w http.ResponseWriter, err error) {
	var oauthErr *oauthserver.Error
	if errors.As(err, &oauthErr) {
		oauthserver.WriteJSON(w, oauthErr)
		return
	}
	log.Errorf("oauth: %v", err)
	oauthserver.WriteJSON(w, oauthserver.ServerError())
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
