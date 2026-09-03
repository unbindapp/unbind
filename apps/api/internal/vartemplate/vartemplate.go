// Package vartemplate parses and renders the ${{source.KEY}} references that
// variable values may contain. Sources are service.<uuid>, team, project and
// environment. Anything that does not match is plain text.
package vartemplate

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

const (
	KeyInternalURL  = "UNBIND_INTERNAL_URL"
	KeyInternalHost = "UNBIND_INTERNAL_HOST"
	KeyInternalPort = "UNBIND_INTERNAL_PORT"
	KeyExternalURL  = "UNBIND_EXTERNAL_URL"
)

var tokenPattern = regexp.MustCompile(`\$\{\{(?:service\.([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})|(team|project|environment))\.([-._a-zA-Z0-9]+)\}\}`)

var endpointKeyPattern = regexp.MustCompile(`^(UNBIND_INTERNAL_URL|UNBIND_INTERNAL_HOST|UNBIND_INTERNAL_PORT|UNBIND_EXTERNAL_URL)(?:_([1-9][0-9]*))?$`)

type Token struct {
	Raw        string
	SourceType schema.VariableReferenceSourceType
	// Zero for team, project and environment tokens
	SourceID uuid.UUID
	Key      string
}

// Resolver returns the value for a token and whether it could be resolved
type Resolver func(token Token) (string, bool)

func HasTokens(value string) bool {
	return tokenPattern.MatchString(value)
}

// Parse returns the distinct tokens in value, in order of first appearance
func Parse(value string) []Token {
	matches := tokenPattern.FindAllStringSubmatch(value, -1)
	if len(matches) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(matches))
	tokens := make([]Token, 0, len(matches))
	for _, match := range matches {
		if _, ok := seen[match[0]]; ok {
			continue
		}
		seen[match[0]] = struct{}{}
		tokens = append(tokens, tokenFromMatch(match))
	}
	return tokens
}

func tokenFromMatch(match []string) Token {
	token := Token{Raw: match[0], Key: match[3]}
	if match[1] != "" {
		token.SourceType = schema.VariableReferenceSourceTypeService
		token.SourceID = uuid.MustParse(match[1])
		return token
	}
	token.SourceType = schema.VariableReferenceSourceType(match[2])
	return token
}

// Render replaces every resolvable token and leaves the rest as literal text.
// It returns the rendered value and the tokens that did not resolve.
func Render(value string, resolve Resolver) (string, []Token) {
	var unresolved []Token
	seenUnresolved := make(map[string]struct{})
	rendered := tokenPattern.ReplaceAllStringFunc(value, func(raw string) string {
		token := tokenFromMatch(tokenPattern.FindStringSubmatch(raw))
		if resolved, ok := resolve(token); ok {
			return resolved
		}
		if _, ok := seenUnresolved[raw]; !ok {
			seenUnresolved[raw] = struct{}{}
			unresolved = append(unresolved, token)
		}
		return raw
	})
	return rendered, unresolved
}

func ServiceToken(serviceID uuid.UUID, key string) string {
	return fmt.Sprintf("${{service.%s.%s}}", serviceID, key)
}

func ScopeToken(sourceType schema.VariableReferenceSourceType, key string) string {
	return fmt.Sprintf("${{%s.%s}}", sourceType, key)
}

// EndpointKey builds UNBIND_INTERNAL_URL, UNBIND_INTERNAL_URL_2, ... for the
// 1-based index of a port or host
func EndpointKey(base string, index int) string {
	if index <= 1 {
		return base
	}
	return fmt.Sprintf("%s_%d", base, index)
}

// ParseEndpointKey splits a key like UNBIND_EXTERNAL_URL_2 into its base and
// 1-based index. ok is false for keys that are not endpoint keys.
func ParseEndpointKey(key string) (base string, index int, ok bool) {
	match := endpointKeyPattern.FindStringSubmatch(key)
	if match == nil {
		return "", 0, false
	}
	index = 1
	if match[2] != "" {
		index, _ = strconv.Atoi(match[2])
	}
	return match[1], index, true
}

func IsEndpointKey(key string) bool {
	return strings.HasPrefix(key, "UNBIND_") && endpointKeyPattern.MatchString(key)
}
