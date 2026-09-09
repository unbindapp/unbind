package watchpaths

import (
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/go-git/go-git/v5/plumbing/format/gitignore"
)

const (
	MaxPatterns      = 100
	MaxPatternLength = 256
)

// Clean trims and dedupes patterns, keeping their order since later patterns win
func Clean(patterns []string) ([]string, error) {
	seen := make(map[string]struct{}, len(patterns))
	cleaned := make([]string, 0, len(patterns))
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		if len(pattern) > MaxPatternLength {
			return nil, fmt.Errorf("watch path must be at most %d characters", MaxPatternLength)
		}
		if _, ok := seen[pattern]; ok {
			continue
		}
		seen[pattern] = struct{}{}
		cleaned = append(cleaned, pattern)
	}
	if len(cleaned) > MaxPatterns {
		return nil, fmt.Errorf("at most %d watch paths are allowed", MaxPatterns)
	}
	return cleaned, nil
}

// ShouldDeploy reports whether any changed file matches the patterns, last matching pattern wins
func ShouldDeploy(patterns []string, changedFiles []string) bool {
	if len(patterns) == 0 {
		return true
	}
	parsed := make([]gitignore.Pattern, 0, len(patterns))
	for _, pattern := range patterns {
		parsed = append(parsed, gitignore.ParsePattern(pattern, nil))
	}
	matcher := gitignore.NewMatcher(parsed)
	for _, file := range changedFiles {
		file = strings.TrimPrefix(file, "/")
		if file == "" {
			continue
		}
		if matcher.Match(strings.Split(file, "/"), false) {
			return true
		}
	}
	return false
}

// Suggestions derives directory and extension globs from a repository's file paths
func Suggestions(files []string) []string {
	set := make(map[string]struct{})
	for _, file := range files {
		file = strings.TrimPrefix(file, "/")
		if file == "" {
			continue
		}
		ext := fileExtension(file)
		if ext != "" {
			set["/**/*"+ext] = struct{}{}
		}
		dir := path.Dir(file)
		if dir == "." {
			set["/"+file] = struct{}{}
			continue
		}
		for ; dir != "."; dir = path.Dir(dir) {
			set["/"+dir+"/**"] = struct{}{}
			if ext != "" {
				set["/"+dir+"/**/*"+ext] = struct{}{}
			}
		}
	}
	suggestions := make([]string, 0, len(set))
	for suggestion := range set {
		suggestions = append(suggestions, suggestion)
	}
	sort.Strings(suggestions)
	return suggestions
}

// Dotfiles like .gitignore have no extension
func fileExtension(file string) string {
	base := path.Base(file)
	ext := path.Ext(base)
	if ext == base {
		return ""
	}
	return ext
}
