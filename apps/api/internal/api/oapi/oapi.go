// Package oapi wraps huma registration so every operation ships with the
// documentation an API consumer (human or agent) needs: a consistent set of
// documented error responses and machine-readable risk hints exposed as the
// `x-agent` OpenAPI extension.
package oapi

import (
	"context"
	"slices"

	"github.com/danielgtaylor/huma/v2"
)

// Action classifies an operation by its effect. It drives the documented error
// responses and the agent risk hints, so callers declare intent once instead of
// hand-listing status codes and extensions on every operation.
type Action int

const (
	// Read is a safe, idempotent, read-only lookup.
	Read Action = iota
	// Create produces a new resource and is not idempotent.
	Create
	// Update mutates an existing resource in place and is idempotent.
	Update
	// Delete removes a resource. Destructive and worth confirming.
	Delete
	// Invoke is a non-idempotent side-effecting action (deploy, restart, trigger).
	Invoke
)

type profile struct {
	errors []int
	hints  map[string]any
}

func agentHints(readOnly, destructive, idempotent bool, risk string, confirm bool) map[string]any {
	return map[string]any{
		"readOnlyHint":         readOnly,
		"destructiveHint":      destructive,
		"idempotentHint":       idempotent,
		"openWorldHint":        false,
		"risk":                 risk,
		"requiresConfirmation": confirm,
	}
}

// baseProfile assumes an authenticated, resource-scoped endpoint, which covers
// the vast majority of operations. Use Public for unauthenticated ones.
func baseProfile(a Action) profile {
	switch a {
	case Read:
		return profile{
			errors: []int{400, 401, 403, 404, 422, 500},
			hints:  agentHints(true, false, true, "low", false),
		}
	case Create:
		return profile{
			errors: []int{400, 401, 403, 404, 409, 422, 500},
			hints:  agentHints(false, false, false, "medium", false),
		}
	case Update:
		return profile{
			errors: []int{400, 401, 403, 404, 409, 422, 500},
			hints:  agentHints(false, false, true, "medium", false),
		}
	case Delete:
		return profile{
			errors: []int{401, 403, 404, 409, 422, 500},
			hints:  agentHints(false, true, false, "high", true),
		}
	case Invoke:
		return profile{
			errors: []int{400, 401, 403, 404, 409, 422, 500},
			hints:  agentHints(false, false, false, "medium", false),
		}
	default:
		return profile{errors: []int{500}, hints: agentHints(false, false, false, "medium", false)}
	}
}

// Option tweaks the derived profile for the cases the Action alone can't infer.
type Option func(*profile)

// Public marks an unauthenticated operation, dropping the auth-implied 401/403
// codes. Add any auth-specific codes (e.g. 401 for login) via op.Errors.
func Public(p *profile) {
	p.errors = without(p.errors, 401, 403)
}

// OpenWorld flags operations that reach external systems (git, registries, DNS,
// the public internet), mapping to MCP's openWorldHint.
func OpenWorld(p *profile) {
	p.hints["openWorldHint"] = true
}

// Confirm forces the confirmation hint on, for sensitive mutations that aren't
// deletes (e.g. rotating credentials, destructive redeploys).
func Confirm(p *profile) {
	p.hints["requiresConfirmation"] = true
}

// Risk overrides the derived risk level ("low" | "medium" | "high").
func Risk(level string) Option {
	return func(p *profile) { p.hints["risk"] = level }
}

// Register documents and registers an operation. It merges the Action's default
// error set with any codes the caller already set on op.Errors, and attaches the
// x-agent extension unless the caller supplied one.
func Register[I, O any](api huma.API, action Action, op huma.Operation, handler func(context.Context, *I) (*O, error), opts ...Option) {
	Apply(action, &op, opts...)
	huma.Register(api, op, handler)
}

// Apply mutates op in place with the derived errors and agent hints. Exposed for
// registration paths that don't go through huma.Register (e.g. sse.Register).
func Apply(action Action, op *huma.Operation, opts ...Option) {
	p := baseProfile(action)
	for _, o := range opts {
		o(&p)
	}

	op.Errors = mergeInts(p.errors, op.Errors)

	if op.Extensions == nil {
		op.Extensions = map[string]any{}
	}
	if _, ok := op.Extensions["x-agent"]; !ok {
		op.Extensions["x-agent"] = p.hints
	}
}

func without(in []int, drop ...int) []int {
	out := in[:0:0]
	for _, v := range in {
		if !slices.Contains(drop, v) {
			out = append(out, v)
		}
	}
	return out
}

func mergeInts(a, b []int) []int {
	out := append([]int{}, a...)
	for _, v := range b {
		if !slices.Contains(out, v) {
			out = append(out, v)
		}
	}
	return out
}
