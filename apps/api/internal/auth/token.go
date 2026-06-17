package auth

import (
	"crypto/rsa"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

const (
	KeyID = "unbind-oauth-key"

	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 24 * time.Hour * 14

	TokenScope = "openid profile email groups offline_access"
)

var ErrInvalidToken = errors.New("invalid token")

type TokenManager struct {
	privateKey *rsa.PrivateKey
	issuer     string
	audience   string
}

func NewTokenManager(privateKey *rsa.PrivateKey, issuer, audience string) *TokenManager {
	return &TokenManager{
		privateKey: privateKey,
		issuer:     issuer,
		audience:   audience,
	}
}

type VerifiedClaims struct {
	Email   string
	Subject string
	Groups  []string
}

// MintAccessToken issues an OIDC-shaped access token. Groups carry the "oidc:"
// prefix that the Kubernetes RBAC bindings match on.
func (self *TokenManager) MintAccessToken(user *ent.User, groups []*ent.Group) (token string, expiresAt time.Time, err error) {
	now := time.Now()
	expiresAt = now.Add(AccessTokenTTL)

	groupClaims := make([]string, len(groups))
	for i, g := range groups {
		groupClaims[i] = fmt.Sprintf("oidc:%s", g.Name)
	}

	claims := jwt.MapClaims{
		"iss":            self.issuer,
		"sub":            user.Email,
		"aud":            self.audience,
		"email":          user.Email,
		"email_verified": true,
		"groups":         groupClaims,
		"iat":            now.Unix(),
		"exp":            expiresAt.Unix(),
	}

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	jwtToken.Header["kid"] = KeyID

	signed, err := jwtToken.SignedString(self.privateKey)
	if err != nil {
		return "", time.Time{}, err
	}

	return signed, expiresAt, nil
}

func (self *TokenManager) Verify(tokenString string) (*VerifiedClaims, error) {
	token, err := jwt.Parse(
		tokenString,
		func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return &self.privateKey.PublicKey, nil
		},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithIssuer(self.issuer),
		jwt.WithAudience(self.audience),
	)
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	email, _ := claims["email"].(string)
	if email == "" {
		return nil, fmt.Errorf("%w: missing email claim", ErrInvalidToken)
	}
	subject, _ := claims["sub"].(string)

	var groups []string
	if raw, ok := claims["groups"].([]any); ok {
		for _, g := range raw {
			if s, ok := g.(string); ok {
				groups = append(groups, s)
			}
		}
	}

	return &VerifiedClaims{
		Email:   email,
		Subject: subject,
		Groups:  groups,
	}, nil
}

func (self *TokenManager) Issuer() string {
	return self.issuer
}

func NewRefreshToken() string {
	return uuid.NewString()
}
