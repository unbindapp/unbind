package oauthserver

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"
)

// IPPolicy decides whether an outbound fetch may connect to an address.
type IPPolicy func(net.IP) bool

// DefaultIPPolicy refuses anything that is not a public unicast address, so a
// client_id URL cannot be used to reach the cluster network or the metadata
// service.
func DefaultIPPolicy(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() || ip.IsMulticast() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		switch {
		case ip4[0] == 0:
			return false
		case ip4[0] == 100 && ip4[1]&0xc0 == 64:
			return false
		case ip4[0] == 192 && ip4[1] == 0 && ip4[2] == 0:
			return false
		case ip4[0] == 198 && ip4[1]&0xfe == 18:
			return false
		case ip4[0] >= 240:
			return false
		}
	}
	return true
}

func AllowAllIPPolicy(net.IP) bool {
	return true
}

// SafeDialContext resolves the host itself and dials only addresses the policy
// allows. Dialing the vetted IP rather than the name closes the DNS rebinding
// window between check and connect.
func SafeDialContext(policy IPPolicy) func(ctx context.Context, network, addr string) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, err
		}
		ips, err := resolve(ctx, host)
		if err != nil {
			return nil, err
		}
		lastErr := errors.New("no allowed address for " + host)
		for _, ip := range ips {
			if !policy(ip) {
				lastErr = fmt.Errorf("address %s of %s is not allowed", ip, host)
				continue
			}
			conn, err := dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
			if err == nil {
				return conn, nil
			}
			lastErr = err
		}
		return nil, lastErr
	}
}

func resolve(ctx context.Context, host string) ([]net.IP, error) {
	if ip := net.ParseIP(host); ip != nil {
		return []net.IP{ip}, nil
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	ips := make([]net.IP, 0, len(addrs))
	for _, addr := range addrs {
		ips = append(ips, addr.IP)
	}
	return ips, nil
}
