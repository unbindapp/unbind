package oauthserver

import (
	"net/url"
	"strings"
)

// VerifiedBrand names a first party the consent page can vouch for.
type VerifiedBrand string

const (
	VerifiedBrandClaude  VerifiedBrand = "claude"
	VerifiedBrandChatGPT VerifiedBrand = "chatgpt"
)

var verifiedBrandByHost = map[string]VerifiedBrand{
	"claude.ai":   VerifiedBrandClaude,
	"chatgpt.com": VerifiedBrandChatGPT,
}

// VerifiedBrandOf vouches for a metadata document client served by a known
// host whose redirects all stay on that host or on this device, so even a
// document planted on the host could only send codes back to it.
func VerifiedBrandOf(documentClientID string, redirectURIs []string) VerifiedBrand {
	if !IsMetadataDocumentClientID(documentClientID) {
		return ""
	}
	document, err := url.Parse(documentClientID)
	if err != nil {
		return ""
	}
	brand, known := verifiedBrandByHost[strings.ToLower(document.Host)]
	if !known || len(redirectURIs) == 0 {
		return ""
	}
	for _, raw := range redirectURIs {
		redirect, err := url.Parse(raw)
		if err != nil {
			return ""
		}
		if IsLoopbackHost(redirect.Hostname()) {
			continue
		}
		if redirect.Scheme != "https" || !strings.EqualFold(redirect.Host, document.Host) {
			return ""
		}
	}
	return brand
}
