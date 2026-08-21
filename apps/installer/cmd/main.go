package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/tui"
)

var Version = "dev"

func main() {
	screen := flag.String("screen", "", "Open a single screen without installing anything, for development: "+strings.Join(tui.DevScreens, ", "))
	domain := flag.String("domain", "unbind.example.com", "Domain to prefill when using -screen")
	flag.Parse()

	model, err := newModel(*screen, *domain)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	if _, err := tea.NewProgram(model, tea.WithAltScreen()).Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running program: %v\n", err)
		os.Exit(1)
	}
}

func newModel(screen, domain string) (tea.Model, error) {
	if screen == "" {
		return tui.NewModel(Version), nil
	}
	return tui.NewDevModel(Version, screen, domain)
}
