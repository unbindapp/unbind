package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/lipgloss/table"
	"golang.org/x/net/publicsuffix"
)

type dnsRecord struct {
	Name    string
	Type    string
	Content string
}

func relativeRecordName(domain string) string {
	domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
	etld1, err := publicsuffix.EffectiveTLDPlusOne(domain)
	if err != nil || etld1 == domain {
		return "@"
	}
	return strings.TrimSuffix(domain, "."+etld1)
}

func wildcardRecordName(relative string) string {
	if relative == "@" {
		return "*"
	}
	return "*." + relative
}

func dnsRecordsFor(domain, ip string) []dnsRecord {
	relative := relativeRecordName(domain)
	return []dnsRecord{
		{Name: relative, Type: "A", Content: ip},
		{Name: wildcardRecordName(relative), Type: "A", Content: ip},
	}
}

func renderDNSRecordsTable(m Model, domain string) string {
	rows := make([][]string, 0, 2)
	for _, record := range dnsRecordsFor(domain, m.dnsInfo.ExternalIP) {
		rows = append(rows, []string{record.Name, record.Type, record.Content})
	}

	t := table.New().
		Border(lipgloss.RoundedBorder()).
		BorderStyle(m.styles.Subtle).
		Headers("Name", "Type", "Content").
		Rows(rows...).
		StyleFunc(func(row, _ int) lipgloss.Style {
			if row == table.HeaderRow {
				return m.styles.Bold.Padding(0, 1)
			}
			return m.styles.Normal.Padding(0, 1)
		})

	rendered := t.Render()
	maxWidth := getUsableWidth(m.width)
	if lipgloss.Width(rendered) <= maxWidth {
		return rendered
	}
	return t.Width(maxWidth).Render()
}
