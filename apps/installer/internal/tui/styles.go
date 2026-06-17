package tui

import (
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/lipgloss"
)

// AppTheme holds the color theme for the application
type AppTheme struct {
	Primary    string // Main brand color (vibrant green)
	Secondary  string // Complementary color
	Accent     string // Accent color for highlights
	Text       string // Default text color
	Subtle     string // Subtle text color
	Error      string // Error color
	Warning    string // Warning color
	Success    string // Success color
	Background string // Background color
	Surface    string // Surface color for UI elements
}

// DefaultTheme returns the default color theme
func DefaultTheme() AppTheme {
	return AppTheme{
		Primary:    "#009900", // hsl(120 100% 30%) - Vibrant green
		Secondary:  "#005500", // Darker green
		Accent:     "#00cc00", // Lighter green
		Text:       "#ffffff", // White text
		Subtle:     "#888888", // Gray text
		Error:      "#ff0000", // Red
		Warning:    "#ffff00", // Yellow
		Success:    "#00ff00", // Bright green
		Background: "#121212", // Dark background
		Surface:    "#242424", // Slightly lighter surface
	}
}

// NewStyles initializes the application styles with the provided theme
func NewStyles(theme AppTheme) Styles {
	return Styles{
		Title: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Primary)).
			Bold(true).
			MarginLeft(1).
			MarginBottom(1),

		Normal: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Text)),

		Bold: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Text)).
			Bold(true),

		Subtle: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Subtle)),

		Error: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Error)),

		Warning: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Warning)),

		StatusBar: lipgloss.NewStyle().
			Foreground(lipgloss.Color("#000000")).
			Background(lipgloss.Color(theme.Primary)).
			Padding(0, 1),

		Key: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Accent)).
			Bold(true),

		SpinnerStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Primary)),

		Success: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Success)).
			Bold(true),

		HighlightButton: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Text)).
			Background(lipgloss.Color(theme.Primary)).
			Padding(0, 2).
			Bold(true),

		SelectedOption: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Accent)).
			Bold(true),
	}
}

// Styles contains the styling for the UI
type Styles struct {
	Title           lipgloss.Style
	Normal          lipgloss.Style
	Bold            lipgloss.Style
	Subtle          lipgloss.Style
	Warning         lipgloss.Style
	Error           lipgloss.Style
	StatusBar       lipgloss.Style
	Key             lipgloss.Style
	SpinnerStyle    lipgloss.Style
	Success         lipgloss.Style
	HighlightButton lipgloss.Style
	SelectedOption  lipgloss.Style
}

// Add a method to create a themed progress bar to the Styles struct
func (s Styles) NewThemedProgress(width int) progress.Model {
	// Create a new progress bar with themed colors and percentage display
	prog := progress.New(
		progress.WithDefaultGradient(), // Use the default gradient for the filled part
		progress.WithGradient(DefaultTheme().Secondary, DefaultTheme().Accent),
	)

	// Set the width after creation (standard bubbletea pattern)
	prog.Width = width

	// Ensure percentages are shown and properly styled
	prog.ShowPercentage = true
	prog.PercentFormat = "%.0f%%" // Show as integer percentage like "45%"
	prog.PercentageStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color(DefaultTheme().Text)).
		Bold(true)

	return prog
}
