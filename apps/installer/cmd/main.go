package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/unbindapp/unbind-installer/internal/tui"
)

var Version = "dev"

func main() {
	// Initialize the Bubble Tea model
	model := tui.NewModel(Version)

	// Run the TUI
	p := tea.NewProgram(model, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error running program: %v\n", err)
		os.Exit(1)
	}
}
