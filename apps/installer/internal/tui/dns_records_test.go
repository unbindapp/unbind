package tui

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDNSRecordsFor(t *testing.T) {
	tests := []struct {
		domain   string
		name     string
		wildcard string
	}{
		{"unbind.yekta.cc", "unbind", "*.unbind"},
		{"mydomain.com", "@", "*"},
		{"MyDomain.com.", "@", "*"},
		{"a.b.example.co.uk", "a.b", "*.a.b"},
		{"foo.github.io", "@", "*"},
		{"localhost", "@", "*"},
	}

	for _, tt := range tests {
		t.Run(tt.domain, func(t *testing.T) {
			records := dnsRecordsFor(tt.domain, "203.0.113.10")
			assert.Equal(t, []dnsRecord{
				{Name: tt.name, Type: "A", Content: "203.0.113.10"},
				{Name: tt.wildcard, Type: "A", Content: "203.0.113.10"},
			}, records)
		})
	}
}

func TestRenderDNSRecordsTableFitsWidth(t *testing.T) {
	m := NewModel("test")
	m.width = 40
	m.dnsInfo.ExternalIP = "203.0.113.10"
	rendered := renderDNSRecordsTable(m, "very.deeply.nested.sub.domain.example.com")
	assert.Contains(t, rendered, "Name")
	assert.Contains(t, rendered, "*.very")
}
