package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// getBanner returns a stylized ASCII art banner for the application
func getBanner(m Model) string {
	return getBannerWithWidth(m, 0) // Use default full banner
}

// getBannerWithWidth returns a banner that fits within the specified width
func getBannerWithWidth(m Model, maxWidth int) string {
	// ASCII art for "Unbind"
	asciiArt := []string{
		" _   _       _     _           _",
		"| | | |_ __ | |__ (_)_ __   __| |",
		"| | | | '_ \\| '_ \\| | '_ \\ / _` |",
		"| |_| | | | | |_) | | | | | (_| |",
		" \\___/|_| |_|_.__/|_|_| |_|\\__,_|",
	}

	// Check if we need a compact version
	bannerWidth := len(asciiArt[0])
	if maxWidth > 0 && maxWidth < bannerWidth+10 {
		// Use compact banner for smaller terminals
		return getCompactBanner(m)
	}

	// Create a bold, gradient-colored style for the banner
	baseStyle := lipgloss.NewStyle().Bold(true)

	// Create colors for a gradient effect - green theme
	colors := []string{"#005500", "#006600", "#007700", "#008800", "#009900"}

	// Apply gradient to ASCII art lines
	var styledLines []string
	for i, line := range asciiArt {
		colorIdx := i % len(colors)
		styledLine := baseStyle.Foreground(lipgloss.Color(colors[colorIdx])).Render(line)
		styledLines = append(styledLines, styledLine)
	}

	// Create subtitle with version
	versionText := fmt.Sprintf("Installer %s", m.version)
	versionStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#00cc00")).
		Bold(true).
		Italic(true)

	// Center the version text under the banner
	paddingSize := (bannerWidth - len(versionText)) / 2
	if paddingSize < 0 {
		paddingSize = 0
	}
	padding := strings.Repeat(" ", paddingSize)

	styledVersion := padding + versionStyle.Render(versionText)

	// Combine the styled lines and version
	banner := strings.Join(styledLines, "\n") + "\n" + styledVersion

	return banner
}

// getCompactBanner returns a compact version of the banner for smaller terminals
func getCompactBanner(m Model) string {
	compactStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#009900")).
		Bold(true)

	versionStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#00cc00")).
		Bold(true).
		Italic(true)

	title := compactStyle.Render("UNBIND")
	version := versionStyle.Render(fmt.Sprintf("v%s", m.version))

	return title + " " + version
}

// getResponsiveBanner returns a banner that adapts to the terminal width
func getResponsiveBanner(m Model) string {
	if m.width <= 0 {
		return getBanner(m) // Use default if no width info
	}

	usableWidth := m.width - 4 // Account for margins

	if usableWidth < 35 {
		return getCompactBanner(m)
	} else {
		return getBannerWithWidth(m, usableWidth)
	}
}
