package network

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

type IPInfo struct {
	InternalIP string
	ExternalIP string
}

func DetectIPs(logFn func(string)) (*IPInfo, error) {
	info := &IPInfo{}

	logFn("Detecting internal IP address...")
	internalIP, err := detectInternalIP()
	if err != nil {
		logFn(fmt.Sprintf("Warning: Could not auto-detect internal IP: %v", err))
	} else {
		info.InternalIP = internalIP
		logFn(fmt.Sprintf("Detected internal IP: %s", internalIP))
	}

	logFn("Detecting external IP address...")
	externalIP, err := detectExternalIP()
	if err != nil {
		logFn(fmt.Sprintf("Error: Could not auto-detect external IP: %v", err))
		return nil, err
	}
	info.ExternalIP = externalIP
	logFn(fmt.Sprintf("Detected external IP: %s", externalIP))

	return info, nil
}

func detectInternalIP() (string, error) {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		defer conn.Close()
		return conn.LocalAddr().(*net.UDPAddr).IP.String(), nil
	}

	output, err := exec.Command("ip", "route", "get", "1").Output()
	if err == nil {
		matches := regexp.MustCompile(`src\s+(\d+\.\d+\.\d+\.\d+)`).FindSubmatch(output)
		if len(matches) > 1 {
			return string(matches[1]), nil
		}
	}

	interfaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			v4 := ipNet.IP.To4()
			if v4 == nil || v4.IsLoopback() {
				continue
			}
			return v4.String(), nil
		}
	}

	return "", fmt.Errorf("could not detect internal IP address")
}

func detectExternalIP() (string, error) {
	services := []string{
		"https://ifconfig.me",
		"https://api.ipify.org",
		"https://ipinfo.io/ip",
		"https://checkip.amazonaws.com",
	}

	client := &http.Client{Timeout: 5 * time.Second}
	for _, service := range services {
		resp, err := client.Get(service)
		if err != nil {
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}
		ip := strings.TrimSpace(string(body))
		if parsed := net.ParseIP(ip); parsed != nil && parsed.To4() != nil {
			return ip, nil
		}
	}

	return "", fmt.Errorf("could not detect external IP address")
}

type DomainCheck struct {
	IPs        []string
	MatchesIP  bool
	Cloudflare bool
}

func (d DomainCheck) Resolved() bool {
	return d.MatchesIP || d.Cloudflare
}

func CheckDomain(domain, expectedIP string, logFn func(string)) DomainCheck {
	ips, err := net.LookupIP(domain)
	if err != nil {
		logFn(fmt.Sprintf("%s: no record found (%v)", domain, err))
		return DomainCheck{}
	}

	check := DomainCheck{}
	for _, ip := range ips {
		check.IPs = append(check.IPs, ip.String())
		if ip.String() == expectedIP {
			check.MatchesIP = true
		}
	}
	logFn(fmt.Sprintf("%s resolves to %s", domain, strings.Join(check.IPs, ", ")))
	if check.MatchesIP {
		return check
	}

	ranges, err := cloudflareIPRanges(logFn)
	if err != nil {
		logFn(err.Error())
		return check
	}
	for _, ip := range ips {
		if ranges.contains(ip) {
			check.Cloudflare = true
			logFn(fmt.Sprintf("%s is proxied through Cloudflare", domain))
			return check
		}
	}
	return check
}
