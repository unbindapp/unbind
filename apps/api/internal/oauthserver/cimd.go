package oauthserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/internal/infrastructure/cache"
)

const (
	metadataDocumentMaxBytes = 8 << 10
	metadataDocumentTimeout  = 5 * time.Second
	metadataCacheMin         = 5 * time.Minute
	metadataCacheMax         = 24 * time.Hour
	metadataCacheDefault     = time.Hour
	maxClientIDLen           = 512
)

var maxAgePattern = regexp.MustCompile(`(?i)(?:^|[\s,])max-age=(\d+)`)

// ClientMetadata is a Client ID Metadata Document, the client's self hosted
// registration. The client_id is the document URL.
type ClientMetadata struct {
	ClientID                string   `json:"client_id"`
	ClientName              string   `json:"client_name"`
	RedirectURIs            []string `json:"redirect_uris"`
	ClientURI               string   `json:"client_uri,omitempty"`
	GrantTypes              []string `json:"grant_types,omitempty"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method,omitempty"`
}

// IsMetadataDocumentClientID reports whether a client_id is a document URL
// rather than a registered id: https, a host and a path.
func IsMetadataDocumentClientID(clientID string) bool {
	if len(clientID) > maxClientIDLen || !strings.HasPrefix(clientID, "https://") {
		return false
	}
	parsed, err := url.Parse(clientID)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
		return false
	}
	if parsed.Path == "" || parsed.Path == "/" {
		return false
	}
	for _, segment := range strings.Split(parsed.Path, "/") {
		if segment == "." || segment == ".." {
			return false
		}
	}
	return true
}

type MetadataFetcher struct {
	client *http.Client
	cache  *cache.RedisCache[ClientMetadata]
}

func NewMetadataFetcher(policy IPPolicy, store *cache.RedisCache[ClientMetadata]) *MetadataFetcher {
	transport := &http.Transport{
		DialContext:         SafeDialContext(policy),
		TLSHandshakeTimeout: metadataDocumentTimeout,
		ForceAttemptHTTP2:   true,
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   metadataDocumentTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	return &MetadataFetcher{client: client, cache: store}
}

// Fetch returns the validated document, from cache when fresh. Failures are
// never cached, so a client can fix its document and retry at once.
func (f *MetadataFetcher) Fetch(ctx context.Context, clientID string) (*ClientMetadata, error) {
	if !IsMetadataDocumentClientID(clientID) {
		return nil, InvalidClient("client_id is not a metadata document url")
	}
	if cached, err := f.cache.Get(ctx, clientID); err == nil {
		return &cached, nil
	} else if !errors.Is(err, redis.Nil) {
		return nil, err
	}

	doc, ttl, err := f.download(ctx, clientID)
	if err != nil {
		return nil, err
	}
	if err := f.cache.SetWithExpiration(ctx, clientID, *doc, ttl); err != nil {
		return nil, err
	}
	return doc, nil
}

func (f *MetadataFetcher) download(ctx context.Context, clientID string) (*ClientMetadata, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, clientID, nil)
	if err != nil {
		return nil, 0, InvalidClient("client_id is not a valid url")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "unbind-oauth")

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, 0, InvalidClient("client metadata document could not be fetched")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, 0, InvalidClient(fmt.Sprintf("client metadata document answered %d", resp.StatusCode))
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, metadataDocumentMaxBytes+1))
	if err != nil {
		return nil, 0, InvalidClient("client metadata document could not be read")
	}
	if len(body) > metadataDocumentMaxBytes {
		return nil, 0, InvalidClient("client metadata document is too large")
	}

	var doc ClientMetadata
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, 0, InvalidClient("client metadata document is not valid json")
	}
	if err := validateClientMetadata(clientID, &doc); err != nil {
		return nil, 0, err
	}
	return &doc, cacheTTL(resp.Header.Get("Cache-Control")), nil
}

func validateClientMetadata(clientID string, doc *ClientMetadata) *Error {
	if doc.ClientID != clientID {
		return InvalidClient("client metadata document client_id does not match its url")
	}
	doc.ClientName = strings.TrimSpace(doc.ClientName)
	if doc.ClientName == "" {
		doc.ClientName = HostOf(clientID)
	}
	if len(doc.ClientName) > maxClientNameLen {
		doc.ClientName = doc.ClientName[:maxClientNameLen]
	}
	if len(doc.RedirectURIs) == 0 {
		return InvalidClient("client metadata document has no redirect_uris")
	}
	for _, uri := range doc.RedirectURIs {
		if err := ValidateRedirectURI(uri); err != nil {
			return InvalidClient("client metadata document redirect_uris: " + err.Error())
		}
	}
	if doc.TokenEndpointAuthMethod != "" && doc.TokenEndpointAuthMethod != authMethodNone {
		return InvalidClient("only public clients (token_endpoint_auth_method none) are supported")
	}
	if err := validateClientURI(doc.ClientURI); err != nil {
		return InvalidClient("client metadata document " + err.Error())
	}
	return nil
}

func cacheTTL(cacheControl string) time.Duration {
	match := maxAgePattern.FindStringSubmatch(cacheControl)
	if match == nil {
		return metadataCacheDefault
	}
	seconds, err := strconv.Atoi(match[1])
	if err != nil {
		return metadataCacheDefault
	}
	return min(max(time.Duration(seconds)*time.Second, metadataCacheMin), metadataCacheMax)
}
