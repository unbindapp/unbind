package network

import (
	"crypto/tls"
	"net"
	"time"
)

// ServesTLS is true when addr presents any certificate for serverName, trust is not checked
func ServesTLS(addr, serverName string, logFn func(string)) bool {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: serverName, InsecureSkipVerify: true})
	if err != nil {
		logFn(serverName + ": TLS handshake failed (" + err.Error() + ")")
		return false
	}
	conn.Close()
	return true
}
