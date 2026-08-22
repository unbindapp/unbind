package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func (m Model) startConfigValidation() (Model, tea.Cmd) {
	m.state = StateDNSValidation
	m.isLoading = true
	m.validation = validationStatus{gen: m.validation.gen + 1}
	m, cmd := m.runValidation(true)
	return m, tea.Batch(cmd, revalidateTick(m.validation.gen))
}

func (m Model) runValidation(checkRegistry bool) (Model, tea.Cmd) {
	m.validation.inFlight = true
	m.validation.startedAt = time.Now()
	return m, m.validateConfig(m.validation.gen, checkRegistry)
}

func (m Model) startInstall() (Model, tea.Cmd) {
	return m.transition(StateCheckingSwap, true, m.checkSwapCommand())
}

func (m Model) updateDNSValidationState(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case revalidateTickMsg:
		if msg.gen != m.validation.gen {
			return m, nil
		}
		var cmd tea.Cmd
		if !m.validation.inFlight && time.Since(m.validation.lastAt) >= revalidateInterval {
			m, cmd = m.runValidation(false)
		}
		return m, tea.Batch(cmd, revalidateTick(msg.gen))

	case dnsValidationResultMsg:
		return m.applyValidationResult(msg), nil

	case tea.KeyMsg:
		switch msg.String() {
		case "enter":
			if !m.validation.ready(m.dnsInfo.RegistryType) {
				return m, nil
			}
			return m.startInstall()
		case "ctrl+r":
			if m.validation.inFlight {
				return m, nil
			}
			return m.runValidation(true)
		case "ctrl+e":
			m.state = StateDNSConfig
			m.isLoading = false
			m.domainInput.SetValue(m.dnsInfo.UnbindDomain)
			return m, m.domainInput.Focus()
		case "ctrl+g":
			m.isLoading = false
			if m.dnsInfo.RegistryType != RegistryExternal {
				m.state = StateRegistryTypeSelection
				return m, nil
			}
			m.state = StateExternalRegistryInput
			return m, m.usernameInput.Focus()
		}
	}
	return m, nil
}

func (m Model) applyValidationResult(msg dnsValidationResultMsg) Model {
	if msg.gen != m.validation.gen {
		return m
	}

	prev := m.validation.result
	if !msg.registryChecked && prev != nil {
		msg.registryChecked = prev.registryChecked
		msg.credentialsValid = prev.credentialsValid
		msg.credentialsErr = prev.credentialsErr
	}

	m.validation.inFlight = false
	m.validation.lastAt = time.Now()
	m.validation.lastDuration = msg.duration
	m.validation.result = &msg
	m.dnsInfo.WildcardResolved = msg.wildcardResolved
	return m
}

func viewDNSValidation(m Model) string {
	s := strings.Builder{}
	maxWidth := getUsableWidth(m.width)
	res := m.validation.result
	external := m.dnsInfo.RegistryType == RegistryExternal
	credentialsRejected := external && res != nil && res.registryChecked && !res.credentialsValid

	switch {
	case res == nil || !res.mainResolved:
		if m.validation.inFlight {
			s.WriteString(m.spinner.View())
		}
		s.WriteString(m.styles.Pending.Render("Waiting for the DNS records to appear…"))
		s.WriteString("\n")
	case credentialsRejected:
		writeWrapped(&s, m.styles.Error, fmt.Sprintf("Registry credentials rejected by %s. Press Ctrl+g to fix them.", getRegistryDisplayName(m.dnsInfo.RegistryHost)), maxWidth)
	case res.wildcardProxied:
		s.WriteString(m.styles.Success.Render("✓ Main DNS record detected. Press Enter to continue."))
		s.WriteString("\n")
		writeWrapped(&s, m.styles.Warning, fmt.Sprintf("The *.%s record is proxied through Cloudflare, but Cloudflare has no certificate for names under it: HTTPS for every service domain will fail. Set that record to DNS-only (grey cloud) before continuing, or add Cloudflare Advanced Certificate Manager.", m.dnsInfo.UnbindDomain), maxWidth)
	case res.wildcardResolved:
		s.WriteString(m.styles.Success.Render("✓ DNS records detected. Press Enter to continue."))
		s.WriteString("\n")
	default:
		s.WriteString(m.styles.Success.Render("✓ Main DNS record detected. Press Enter to continue."))
		s.WriteString("\n")
		writeWrapped(&s, m.styles.Warning, "Wildcard record not detected yet. It's optional, but without it automatic domain generation for your services is disabled. You can continue now or wait for it to appear.", maxWidth)
	}
	s.WriteString("\n")

	s.WriteString(renderDNSRecordsTable(m, m.dnsInfo.UnbindDomain))
	s.WriteString("\n\n")

	s.WriteString(m.styles.Bold.Render("Checks:"))
	s.WriteString("\n")
	s.WriteString(m.renderMainRecordCheck())
	s.WriteString(m.renderWildcardRecordCheck())
	if external {
		s.WriteString(m.renderCredentialsCheck())
	}
	s.WriteString("\n")

	writeWrapped(&s, m.styles.Subtle, m.validationTimingText(), maxWidth)
	writeWrapped(&s, m.styles.Subtle, fmt.Sprintf("DNS changes can take a few minutes (occasionally up to 24-48 hours) to propagate. We re-check every %d seconds.", int(revalidateInterval.Seconds())), maxWidth)
	s.WriteString("\n")

	s.WriteString(m.styles.Bold.Render("Options:"))
	s.WriteString("\n")
	hints := []keyHint{}
	if m.validation.ready(m.dnsInfo.RegistryType) {
		hints = append(hints, keyHint{key: "Enter", desc: "Continue"})
	}
	hints = append(hints,
		keyHint{key: "Ctrl+r", desc: "Re-check now"},
		keyHint{key: "Ctrl+e", desc: "Edit domain"},
		keyHint{key: "Ctrl+g", desc: "Edit registry"},
	)
	s.WriteString(renderKeyHints(m, hints...))
	s.WriteString("\n\n")
	s.WriteString(quitHint(m))
	return renderPage(m, s.String())
}

func (m Model) renderMainRecordCheck() string {
	label := m.dnsInfo.UnbindDomain + " (required)"
	res := m.validation.result
	switch {
	case res == nil:
		return renderCheckLine(m, checkPending, label, "checking…")
	case res.mainResolved && res.mainCloudflare:
		return renderCheckLine(m, checkOK, label, "proxied through Cloudflare")
	case res.mainResolved:
		return renderCheckLine(m, checkOK, label, "→ "+m.dnsInfo.ExternalIP)
	case len(res.mainIPs) > 0:
		return renderCheckLine(m, checkWarn, label, fmt.Sprintf("resolves to %s, expected %s", strings.Join(res.mainIPs, ", "), m.dnsInfo.ExternalIP))
	default:
		return renderCheckLine(m, checkPending, label, "no record found yet")
	}
}

func (m Model) renderWildcardRecordCheck() string {
	label := "*." + m.dnsInfo.UnbindDomain + " (optional)"
	res := m.validation.result
	switch {
	case res == nil:
		return renderCheckLine(m, checkPending, label, "checking…")
	case res.wildcardProxied:
		detail := fmt.Sprintf("proxied through Cloudflare with no edge certificate for *.%s (Universal SSL covers one level only) — set the record to DNS-only (grey cloud)", m.dnsInfo.UnbindDomain)
		return renderCheckLine(m, checkFail, label, detail)
	case res.wildcardResolved && res.wildcardCloudflare:
		return renderCheckLine(m, checkOK, label, "proxied through Cloudflare")
	case res.wildcardResolved:
		return renderCheckLine(m, checkOK, label, "→ "+m.dnsInfo.ExternalIP)
	default:
		return renderCheckLine(m, checkPending, label, "not detected yet — automatic service domains stay disabled until it is")
	}
}

func (m Model) renderCredentialsCheck() string {
	label := fmt.Sprintf("Registry credentials: %s (%s)", getRegistryDisplayName(m.dnsInfo.RegistryHost), m.dnsInfo.RegistryUsername)
	res := m.validation.result
	switch {
	case res == nil || !res.registryChecked:
		return renderCheckLine(m, checkPending, label, "checking…")
	case res.credentialsValid:
		return renderCheckLine(m, checkOK, label, "")
	default:
		return renderCheckLine(m, checkFail, label, res.credentialsErr)
	}
}

func (m Model) validationTimingText() string {
	v := m.validation
	switch {
	case v.inFlight && v.result == nil:
		return "First check running…"
	case v.inFlight:
		return fmt.Sprintf("Validating… (last attempt took %s)", formatDuration(v.lastDuration))
	default:
		return fmt.Sprintf("Validation attempted %s ago (took %s)", time.Since(v.lastAt).Round(time.Second), formatDuration(v.lastDuration))
	}
}

func formatDuration(d time.Duration) string {
	if d < time.Second {
		return d.Round(time.Millisecond).String()
	}
	return d.Round(100 * time.Millisecond).String()
}
