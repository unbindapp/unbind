package registry

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var ErrInvalidCredentials = errors.New("registry rejected the credentials")

// Token flow per https://distribution.github.io/distribution/spec/auth/token/
func CheckCredentials(ctx context.Context, host, username, password string) error {
	client := &http.Client{Timeout: 15 * time.Second}
	return checkCredentials(ctx, client, "https://"+apiHost(host), username, password)
}

func checkCredentials(ctx context.Context, client *http.Client, baseURL, username, password string) error {
	resp, err := getWithBasicAuth(ctx, client, baseURL+"/v2/", username, password)
	if err != nil {
		return fmt.Errorf("could not reach %s: %w", baseURL, err)
	}
	resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		return nil
	case http.StatusUnauthorized:
	default:
		return fmt.Errorf("unexpected status %d from %s", resp.StatusCode, baseURL)
	}

	challenge, ok := parseBearerChallenge(resp.Header.Get("WWW-Authenticate"))
	if !ok {
		return ErrInvalidCredentials
	}

	tokenURL, err := challenge.tokenURL()
	if err != nil {
		return err
	}

	tokenResp, err := getWithBasicAuth(ctx, client, tokenURL, username, password)
	if err != nil {
		return fmt.Errorf("could not reach %s: %w", challenge.realm, err)
	}
	tokenResp.Body.Close()

	switch tokenResp.StatusCode {
	case http.StatusOK:
		return nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return ErrInvalidCredentials
	default:
		return fmt.Errorf("unexpected status %d from %s", tokenResp.StatusCode, challenge.realm)
	}
}

func getWithBasicAuth(ctx context.Context, client *http.Client, rawURL, username, password string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(username, password)
	return client.Do(req)
}

func apiHost(host string) string {
	host = strings.TrimPrefix(strings.TrimPrefix(host, "https://"), "http://")
	host = strings.TrimSuffix(host, "/")
	switch host {
	case "docker.io", "index.docker.io":
		return "registry-1.docker.io"
	default:
		return host
	}
}

type bearerChallenge struct {
	realm   string
	service string
	scope   string
}

var challengeParam = regexp.MustCompile(`(?i)\b(realm|service|scope)="([^"]*)"`)

func parseBearerChallenge(header string) (bearerChallenge, bool) {
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return bearerChallenge{}, false
	}

	c := bearerChallenge{}
	for _, match := range challengeParam.FindAllStringSubmatch(header, -1) {
		switch strings.ToLower(match[1]) {
		case "realm":
			c.realm = match[2]
		case "service":
			c.service = match[2]
		case "scope":
			c.scope = match[2]
		}
	}
	if c.realm == "" {
		return bearerChallenge{}, false
	}
	return c, true
}

func (c bearerChallenge) tokenURL() (string, error) {
	u, err := url.Parse(c.realm)
	if err != nil {
		return "", fmt.Errorf("invalid auth realm %q: %w", c.realm, err)
	}

	q := u.Query()
	if c.service != "" {
		q.Set("service", c.service)
	}
	if c.scope != "" {
		q.Set("scope", c.scope)
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}
