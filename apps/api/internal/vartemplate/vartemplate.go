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

// endpointLabels are the protocol names a key may carry instead of a port number.
// They belong to engines that speak more than one protocol, so a key reads the same
// whichever port the engine happens to answer on.
var endpointLabels = []string{"HTTP"}

var tokenPattern = regexp.MustCompile(`\$\{\{(?:service\.([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})|(team|project|environment))\.([-._a-zA-Z0-9]+)\}\}`)

type Token struct {
	Raw        string
	SourceType schema.VariableReferenceSourceType
	// Zero for team, project and environment tokens
	SourceID uuid.UUID
	Key      string
}

// EndpointRef is a parsed endpoint key. Label selects an endpoint by the protocol it
// carries and Port by the container port it fronts; both are empty for the unsuffixed
// key, which always means the primary protocol. Tiebreak separates hosts that share
// an endpoint. Index is set only for legacy keys, which selected by position instead.
type EndpointRef struct {
	Base     string
	Label    string
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

// EndpointKey names the endpoint of base that suffix identifies: the protocol for an
// engine that speaks more than one, the container port for everything else. An empty
// suffix is the primary endpoint, which keeps the bare base. Tiebreak separates hosts
// sharing an endpoint and is omitted for the first of them.
func EndpointKey(base, suffix string, tiebreak int) string {
	if suffix == "" {
		return base
	}
	if tiebreak <= 1 {
		return fmt.Sprintf("%s_%s", base, suffix)
	}
	return fmt.Sprintf("%s_%s_%d", base, suffix, tiebreak)
}

// PortSuffix names an endpoint by the container port it fronts, which is all there is
// to go on for a service whose ports are arbitrary
func PortSuffix(port int32) string {
	if port <= 0 {
		return ""
	}
	return strconv.Itoa(int(port))
}

// ParseEndpointKey splits a key like UNBIND_URL_PUBLIC_8080_2 or
// UNBIND_DATABASE_URL_PRIVATE_HTTP into its parts. ok is false for keys that are not
// endpoint keys.
func ParseEndpointKey(key string) (EndpointRef, bool) {
	if !strings.HasPrefix(key, endpointKeyPrefix) {
		return EndpointRef{}, false
	}

	// Try the bare key first, then peel one and two trailing segments, so a base is
	// never mistaken for a shorter one that happens to be a prefix of it
	for stripped := range 3 {
		base, segments, ok := splitTrailingSegments(key, stripped)
		if !ok {
			break
		}
		if newBase, isLegacy := legacyEndpointBases[base]; isLegacy {
			if ref, ok := legacyEndpointRef(newBase, segments); ok {
				return ref, true
			}
			continue
		}
		if !slices.Contains(endpointBases, base) {
			continue
		}
		if ref, ok := endpointRef(base, segments); ok {
			return ref, true
		}
	}

	return EndpointRef{}, false
}

// endpointRef reads the segments trailing a base: a protocol label or a container
// port, then an optional tiebreaker
func endpointRef(base string, segments []string) (EndpointRef, bool) {
	ref := EndpointRef{Base: base}
	if len(segments) == 0 {
		return ref, true
	}
	if slices.Contains(endpointLabels, segments[0]) {
		ref.Label = segments[0]
	} else {
		port, ok := positiveNumber(segments[0])
		if !ok {
			return EndpointRef{}, false
		}
		ref.Port = int32(port)
	}
	if len(segments) < 2 {
		return ref, true
	}
	tiebreak, ok := positiveNumber(segments[1])
	if !ok {
		return EndpointRef{}, false
	}
	ref.Tiebreak = tiebreak
	return ref, true
}

// legacyEndpointRef reads a pre-rename key, whose only suffix was the 1-based
// position of the endpoint it selected
func legacyEndpointRef(base string, segments []string) (EndpointRef, bool) {
	ref := EndpointRef{Base: base, Index: 1, Legacy: true}
	if len(segments) == 0 {
		return ref, true
	}
	if len(segments) > 1 {
		return EndpointRef{}, false
	}
	index, ok := positiveNumber(segments[0])
	if !ok {
		return EndpointRef{}, false
	}
	ref.Index = index
	return ref, true
}

// splitTrailingSegments removes count trailing _<segment> parts, returning the
// remaining base and the segments in the order they appear in the key
func splitTrailingSegments(key string, count int) (string, []string, bool) {
	segments := make([]string, 0, count)
	base := key
	for range count {
		index := strings.LastIndex(base, "_")
		if index < 0 || index == len(base)-1 {
			return "", nil, false
		}
		segments = append(segments, base[index+1:])
		base = base[:index]
	}
	slices.Reverse(segments)
	return base, segments, true
}

func positiveNumber(segment string) (int, bool) {
	number, err := strconv.Atoi(segment)
	if err != nil || number < 1 {
		return 0, false
	}
	return number, true
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
