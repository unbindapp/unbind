package utils

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
)

func DecodePrivateKey(keyData string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(keyData))
	if block == nil {
		return nil, fmt.Errorf("failed to decode private key")
	}

	return x509.ParsePKCS1PrivateKey(block.Bytes)
}
