package oauth_repo

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

func (self *OauthRepository) GetOrGenerateJWTPrivateKey(ctx context.Context) (*rsa.PrivateKey, []byte, error) {
	// Get the first key from the DB
	key, err := self.base.DB.JWTKey.Query().First(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return nil, nil, err
	}
	if key != nil {
		return decodePrivateKey(key.PrivateKey)
	}

	// Generate a new RSA private key
	rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatalf("failed to generate RSA key: %v", err)
	}

	// 4) Encode the RSA key in PEM format.
	derStream := x509.MarshalPKCS1PrivateKey(rsaKey)
	pemBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: derStream,
	}
	pemBytes := pem.EncodeToMemory(pemBlock) // []byte PEM

	// Save key
	newKey, err := self.base.DB.JWTKey.
		Create().
		SetLabel("unbind-default").
		SetPrivateKey(pemBytes).
		Save(ctx)
	if err != nil {
		return nil, nil, err
	}

	return decodePrivateKey(newKey.PrivateKey)
}

func decodePrivateKey(pkey []byte) (*rsa.PrivateKey, []byte, error) {
	// Decode the PEM block
	block, _ := pem.Decode(pkey) // k.PrivateKey is []byte from the DB
	if block == nil || block.Type != "RSA PRIVATE KEY" {
		return nil, nil, fmt.Errorf("not a valid PEM block")
	}

	parsedKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse RSA private key: %w", err)
	}

	return parsedKey, pkey, nil
}
