// Package vartemplate parses and renders the ${{source.KEY}} references that
// variable values may contain. Sources are service.<uuid>, team, project and
// environment. Anything that does not match is plain text.
package vartemplate

import (
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

// Endpoint keys describe how to reach a service. They are computed when a variable
// is rendered rather than stored, so they cannot be edited, deleted or go stale.
const (
	// KeyURLPrivate is the in-cluster URL of a non-database service
	KeyURLPrivate = "UNBIND_URL_PRIVATE"
	// KeyURLPublic is the internet-facing URL of a non-database service
	KeyURLPublic = "UNBIND_URL_PUBLIC"
	// KeyHostPrivate is the in-cluster address, always a DNS name
	KeyHostPrivate = "UNBIND_HOST_PRIVATE"
	// KeyHostPublic is the internet-facing address, a DNS name or a bare IP
	KeyHostPublic = "UNBIND_HOST_PUBLIC"
	// KeyDomainPublic is the internet-facing address only when it is a DNS name.
	// There is no private counterpart: an in-cluster address is always a name.
	KeyDomainPublic = "UNBIND_DOMAIN_PUBLIC"
	// KeyPortPrivate is the container port
	KeyPortPrivate = "UNBIND_PORT_PRIVATE"
	// KeyPortPublic is the port the service answers on from outside the cluster
	KeyPortPublic = "UNBIND_PORT_PUBLIC"
	// KeyDatabaseURLPrivate is a database's in-cluster connection string, credentials included
	KeyDatabaseURLPrivate = "UNBIND_DATABASE_URL_PRIVATE"
	// KeyDatabaseURLPublic is a database's internet-facing connection string
	KeyDatabaseURLPublic = "UNBIND_DATABASE_URL_PUBLIC"
)

var endpointBases = []string{
	KeyURLPrivate,
	KeyURLPublic,
	KeyHostPrivate,
	KeyHostPublic,
	KeyDomainPublic,
	KeyPortPrivate,
	KeyPortPublic,
	KeyDatabaseURLPrivate,
	KeyDatabaseURLPublic,
}

// Keys renamed in the public/private scheme. Accepted for one release so references
// written before the rename keep resolving; their suffix is a 1-based index rather
// than a port.
var legacyEndpointBases = map[string]string{
	"UNBIND_INTERNAL_URL":  KeyURLPrivate,
	"UNBIND_INTERNAL_HOST": KeyHostPrivate,
	"UNBIND_INTERNAL_PORT": KeyPortPrivate,
	"UNBIND_EXTERNAL_URL":  KeyURLPublic,
}

const endpointKeyPrefix = "UNBIND_"

var tokenPattern = regexp.MustCompile(`\$\{\{(?:service\.([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})|(team|project|environment))\.([-._a-zA-Z0-9]+)\}\}`)

type Token struct {
	Raw        string
	SourceType schema.VariableReferenceSourceType
	// Zero for team, project and environment tokens
	SourceID uuid.UUID
	Key      string
}

// EndpointRef is a parsed endpoint key. Port selects which endpoint the key refers
// to and is zero for the unsuffixed key, which always means the primary endpoint.
// Tiebreak separates hosts that share a port. Index is set only for legacy keys,
// which selected an endpoint by position instead.
type EndpointRef struct {
	Base     string
	Port     int32
	Tiebreak int
	Index    int
	Legacy   bool
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

// EndpointKey names the endpoint of base reached on port. The primary endpoint keeps
// the bare base so adding a second port never renames an existing key. Tiebreak
// separates hosts sharing a port and is omitted for the first of them.
func EndpointKey(base string, port int32, tiebreak int) string {
	if port <= 0 {
		return base
	}
	if tiebreak <= 1 {
		return fmt.Sprintf("%s_%d", base, port)
	}
	return fmt.Sprintf("%s_%d_%d", base, port, tiebreak)
}

// ParseEndpointKey splits a key like UNBIND_URL_PUBLIC_8080_2 into its parts.
// ok is false for keys that are not endpoint keys.
func ParseEndpointKey(key string) (EndpointRef, bool) {
	if !strings.HasPrefix(key, endpointKeyPrefix) {
		return EndpointRef{}, false
	}

	// Try the bare key first, then peel one and two trailing numbers, so a base is
	// never mistaken for a shorter one that happens to be a prefix of it
	for stripped := range 3 {
		base, numbers, ok := splitTrailingNumbers(key, stripped)
		if !ok {
			break
		}
		if newBase, isLegacy := legacyEndpointBases[base]; isLegacy {
			if stripped > 1 {
				return EndpointRef{}, false
			}
			ref := EndpointRef{Base: newBase, Index: 1, Legacy: true}
			if stripped == 1 {
				ref.Index = numbers[0]
			}
			return ref, true
		}
		if !slices.Contains(endpointBases, base) {
			continue
		}
		ref := EndpointRef{Base: base}
		if stripped > 0 {
			ref.Port = int32(numbers[0])
		}
		if stripped > 1 {
			ref.Tiebreak = numbers[1]
		}
		return ref, true
	}

	return EndpointRef{}, false
}

// splitTrailingNumbers removes count trailing _<number> segments, returning the
// remaining base and the numbers in the order they appear in the key
func splitTrailingNumbers(key string, count int) (string, []int, bool) {
	numbers := make([]int, 0, count)
	base := key
	for range count {
		index := strings.LastIndex(base, "_")
		if index < 0 {
			return "", nil, false
		}
		number, err := strconv.Atoi(base[index+1:])
		if err != nil || number < 1 {
			return "", nil, false
		}
		numbers = append(numbers, number)
		base = base[:index]
	}
	slices.Reverse(numbers)
	return base, numbers, true
}

func IsEndpointKey(key string) bool {
	_, ok := ParseEndpointKey(key)
	return ok
}

// RenameKeys rewrites the key of every service token that rename resolves, returning
// the new value and whether anything changed
func RenameKeys(value string, rename func(token Token) (string, bool)) (string, bool) {
	changed := false
	rendered := tokenPattern.ReplaceAllStringFunc(value, func(raw string) string {
		token := tokenFromMatch(tokenPattern.FindStringSubmatch(raw))
		if token.SourceType != schema.VariableReferenceSourceTypeService {
			return raw
		}
		renamed, ok := rename(token)
		if !ok {
			return raw
		}
		changed = true
		return ServiceToken(token.SourceID, renamed)
	})
	return rendered, changed
}

// EndpointKeyRenamer turns the position a legacy key selected by into the key that
// selects the same endpoint by port. Returning false leaves the token untouched.
type EndpointKeyRenamer func(token Token, ref EndpointRef) (string, bool)

// RenameLegacyEndpointKeys rewrites the tokens in value that use a pre-rename
// endpoint key, returning the new value and whether anything changed. Positional
// suffixes cannot be translated by string surgery alone, so rename resolves them
// against the source service.
func RenameLegacyEndpointKeys(value string, rename EndpointKeyRenamer) (string, bool) {
	changed := false
	rendered := tokenPattern.ReplaceAllStringFunc(value, func(raw string) string {
		token := tokenFromMatch(tokenPattern.FindStringSubmatch(raw))
		ref, ok := ParseEndpointKey(token.Key)
		if !ok || !ref.Legacy {
			return raw
		}
		renamed, ok := rename(token, ref)
		if !ok {
			return raw
		}
		changed = true
		if token.SourceType == schema.VariableReferenceSourceTypeService {
			return ServiceToken(token.SourceID, renamed)
		}
		return ScopeToken(token.SourceType, renamed)
	})
	return rendered, changed
}
