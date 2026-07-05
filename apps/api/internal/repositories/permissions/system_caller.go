package permissions_repo

import "context"

type systemCallerKey struct{}

// WithSystemCaller marks ctx as an internal trusted caller (CLI, bootstrap);
// permission checks are bypassed for such contexts. Never set on HTTP paths.
func WithSystemCaller(ctx context.Context) context.Context {
	return context.WithValue(ctx, systemCallerKey{}, true)
}

func IsSystemCaller(ctx context.Context) bool {
	v, _ := ctx.Value(systemCallerKey{}).(bool)
	return v
}
