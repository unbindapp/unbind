package loki

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// CompileSearch turns a user search expression into a LogQL pipeline fragment.
//
// Syntax:
//   - bare words match case-insensitively; "quoted phrases" match exactly
//   - terms are ANDed by default; OR combines alternatives (binds tighter than AND)
//   - a leading - negates a term
//   - @key:value matches a field of JSON-formatted log lines
//
// Everything is escaped before it reaches LogQL, so the result is safe to
// append to a selector regardless of user input.
func CompileSearch(expr string) (string, error) {
	tokens, err := tokenizeSearch(expr)
	if err != nil {
		return "", err
	}
	if len(tokens) == 0 {
		return "", nil
	}

	groups, attrs, err := parseSearch(tokens)
	if err != nil {
		return "", err
	}

	var pipeline []string
	for _, group := range groups {
		pipeline = append(pipeline, compileGroup(group))
	}
	if len(attrs) > 0 {
		pipeline = append(pipeline, "| json")
		for _, attr := range attrs {
			pipeline = append(pipeline, compileAttr(attr))
		}
	}
	return strings.Join(pipeline, " "), nil
}

type searchToken struct {
	text    string
	quoted  bool
	negated bool
	attrKey string // set for @key:value tokens
	isAnd   bool
	isOr    bool
}

var attrKeyPattern = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

func isSearchSpace(r rune) bool {
	return r == ' ' || r == '\t' || r == '\n' || r == '\r'
}

func tokenizeSearch(expr string) ([]searchToken, error) {
	var tokens []searchToken
	runes := []rune(expr)
	i := 0
	for i < len(runes) {
		if isSearchSpace(runes[i]) {
			i++
			continue
		}

		negated := false
		if runes[i] == '-' && i+1 < len(runes) && !isSearchSpace(runes[i+1]) && runes[i+1] != '-' {
			negated = true
			i++
		}

		if runes[i] == '"' {
			end := -1
			for j := i + 1; j < len(runes); j++ {
				if runes[j] == '"' {
					end = j
					break
				}
			}
			if end == -1 {
				return nil, fmt.Errorf("unclosed quote in search")
			}
			text := string(runes[i+1 : end])
			if text != "" {
				tokens = append(tokens, searchToken{text: text, quoted: true, negated: negated})
			}
			i = end + 1
			continue
		}

		start := i
		for i < len(runes) && !isSearchSpace(runes[i]) && runes[i] != '"' {
			i++
		}
		word := string(runes[start:i])
		if word == "" {
			continue
		}

		if !negated && word == "AND" {
			tokens = append(tokens, searchToken{isAnd: true})
			continue
		}
		if !negated && word == "OR" {
			tokens = append(tokens, searchToken{isOr: true})
			continue
		}

		if key, value, ok := splitAttrToken(word); ok {
			tokens = append(tokens, searchToken{text: value, negated: negated, attrKey: key})
			continue
		}

		tokens = append(tokens, searchToken{text: word, negated: negated})
	}
	return tokens, nil
}

func splitAttrToken(word string) (key, value string, ok bool) {
	if !strings.HasPrefix(word, "@") {
		return "", "", false
	}
	key, value, found := strings.Cut(word[1:], ":")
	if !found || value == "" || !attrKeyPattern.MatchString(key) {
		return "", "", false
	}
	return key, value, true
}

// parseSearch groups tokens: OR chains terms into one group, AND (or plain
// adjacency) separates groups. Attribute tokens are collected separately since
// they compile to label filters after `| json`.
func parseSearch(tokens []searchToken) ([][]searchToken, []searchToken, error) {
	var groups [][]searchToken
	var attrs []searchToken
	var current []searchToken
	pendingOr := false

	flush := func() {
		if len(current) > 0 {
			groups = append(groups, current)
			current = nil
		}
	}

	for _, token := range tokens {
		switch {
		case token.isAnd:
			if pendingOr {
				return nil, nil, fmt.Errorf("misplaced AND in search")
			}
			flush()
		case token.isOr:
			if len(current) == 0 {
				return nil, nil, fmt.Errorf("misplaced OR in search")
			}
			pendingOr = true
		case token.attrKey != "":
			if pendingOr {
				return nil, nil, fmt.Errorf("@%s filters cannot be combined with OR", token.attrKey)
			}
			flush()
			attrs = append(attrs, token)
		default:
			if pendingOr {
				if token.negated {
					return nil, nil, fmt.Errorf("negated terms cannot be combined with OR")
				}
				pendingOr = false
				current = append(current, token)
				continue
			}
			flush()
			current = append(current, token)
		}
	}
	if pendingOr {
		return nil, nil, fmt.Errorf("search ends with a dangling OR")
	}
	flush()

	for _, group := range groups {
		if len(group) > 1 && group[0].negated {
			return nil, nil, fmt.Errorf("negated terms cannot be combined with OR")
		}
	}
	return groups, attrs, nil
}

func compileGroup(group []searchToken) string {
	if len(group) == 1 {
		token := group[0]
		if token.quoted {
			if token.negated {
				return "!= " + logqlString(token.text)
			}
			return "|= " + logqlString(token.text)
		}
		pattern := "(?i)" + regexp.QuoteMeta(token.text)
		if token.negated {
			return "!~ " + logqlString(pattern)
		}
		return "|~ " + logqlString(pattern)
	}

	// OR group: one regex with per-branch case sensitivity
	branches := make([]string, len(group))
	for i, token := range group {
		if token.quoted {
			branches[i] = regexp.QuoteMeta(token.text)
		} else {
			branches[i] = "(?i:" + regexp.QuoteMeta(token.text) + ")"
		}
	}
	return "|~ " + logqlString("("+strings.Join(branches, "|")+")")
}

func compileAttr(token searchToken) string {
	pattern := "(?i)" + regexp.QuoteMeta(token.text)
	if token.negated {
		return fmt.Sprintf("| %s !~ %s", token.attrKey, logqlString(pattern))
	}
	return fmt.Sprintf("| %s =~ %s", token.attrKey, logqlString(pattern))
}

// logqlString renders a LogQL double-quoted string literal; LogQL uses
// Go-style escaping, so strconv.Quote is exactly right.
func logqlString(s string) string {
	return strconv.Quote(s)
}
