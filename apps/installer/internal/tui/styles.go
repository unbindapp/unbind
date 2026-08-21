package tui

import (
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/lipgloss"
)

type AppTheme struct {
	Primary   string
	Secondary string
	Accent    string
	Text      string
	Subtle    string
	Error     string
	Warning   string
	Pending   string
	Success   string
}

func DefaultTheme() AppTheme {
	return AppTheme{
		Primary:   "#009900",
		Secondary: "#005500",
		Accent:    "#00cc00",
		Text:      "#ffffff",
		Subtle:    "#888888",
		Error:     "#ff0000",
		Warning:   "#ffff00",
		Pending:   "#ff8800",
		Success:   "#00ff00",
	}
}

type Styles struct {
	theme           AppTheme
	Title           lipgloss.Style
	Normal          lipgloss.Style
	Bold            lipgloss.Style
	Subtle          lipgloss.Style
	Warning         lipgloss.Style
	Pending         lipgloss.Style
	Error           lipgloss.Style
	Key             lipgloss.Style
	SpinnerStyle    lipgloss.Style
	Success         lipgloss.Style
	HighlightButton lipgloss.Style
	SelectedOption  lipgloss.Style
	KeyHint         lipgloss.Style
	InputBox        lipgloss.Style
	InputPrompt     lipgloss.Style
}

func NewStyles(theme AppTheme) Styles {
	return Styles{
		theme: theme,
		Title: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Primary)).
			Bold(true).
			MarginLeft(1).
			MarginBottom(1),
		Normal:  lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Text)),
		Bold:    lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Text)).Bold(true),
		Subtle:  lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Subtle)),
		Error:   lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Error)),
		Warning: lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Warning)),
		Pending: lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Pending)).Bold(true),
		Key:     lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Accent)).Bold(true),
		SpinnerStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Primary)),
		Success: lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Success)).Bold(true),
		HighlightButton: lipgloss.NewStyle().
			Foreground(lipgloss.Color(theme.Text)).
			Background(lipgloss.Color(theme.Primary)).
			Padding(0, 2).
			Bold(true),
		SelectedOption: lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Accent)).Bold(true),
		KeyHint: lipgloss.NewStyle().
			Foreground(lipgloss.Color("#000000")).
			Background(lipgloss.Color(theme.Accent)).
			Padding(0, 1).
			Bold(true),
		InputBox: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color(theme.Primary)).
			Padding(0, 1),
		InputPrompt: lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Primary)),
	}
}

func (s Styles) NewThemedProgress(width int) progress.Model {
	prog := progress.New(progress.WithGradient(s.theme.Secondary, s.theme.Accent))
	prog.Width = width
	prog.ShowPercentage = true
	prog.PercentFormat = "%.0f%%"
	prog.PercentageStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(s.theme.Text)).Bold(true)
	return prog
}
