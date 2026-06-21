// Package apictx defines the typed context keys shared between the auth
// middleware (which sets them) and request handlers (which read them).
package apictx

type contextKey string

const (
	UserKey        contextKey = "user"
	BearerTokenKey contextKey = "bearer_token"
)
