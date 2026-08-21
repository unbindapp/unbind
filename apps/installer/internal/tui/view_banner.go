package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var bannerArt = []string{
	" _   _       _     _           _",
	"| | | |_ __ | |__ (_)_ __   __| |",
	"| | | | '_ \\| '_ \\| | '_ \\ / _` |",
	"| |_| | | | | |_) | | | | | (_| |",
	" \\___/|_| |_|_.__/|_|_| |_|\\__,_|",
}

var bannerGradient = []string{"#005500", "#006600", "#007700", "#008800", "#009900"}

func getBanner(m Model) string {
	bannerWidth := len(bannerArt[0])
	base := lipgloss.NewStyle().Bold(true)

	lines := make([]string, 0, len(bannerArt)+1)
	for i, line := range bannerArt {
		lines = append(lines, base.Foreground(lipgloss.Color(bannerGradient[i%len(bannerGradient)])).Render(line))
	}

	version := versionStyle(m).Render("Installer " + m.version)
	lines = append(lines, lipgloss.PlaceHorizontal(bannerWidth, lipgloss.Center, version))
	return strings.Join(lines, "\n")
}

func getCompactBanner(m Model) string {
	title := lipgloss.NewStyle().Foreground(lipgloss.Color(m.styles.theme.Primary)).Bold(true).Render("UNBIND")
	return title + " " + versionStyle(m).Render("v"+m.version)
}

func versionStyle(m Model) lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color(m.styles.theme.Accent)).Bold(true).Italic(true)
}

func getResponsiveBanner(m Model) string {
	if m.width <= 0 {
		return getBanner(m)
	}
	if m.width-4 < len(bannerArt[0])+10 {
		return getCompactBanner(m)
	}
	return getBanner(m)
}
