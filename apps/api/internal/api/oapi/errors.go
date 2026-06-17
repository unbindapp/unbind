package oapi

import (
	"errors"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// MapError translates a domain error into the documented huma response. It is the
// single place that decides which HTTP status a given failure produces, so every
// handler reports errors consistently with the codes declared on each operation.
func MapError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, errdefs.ErrInvalidInput):
		return huma.Error400BadRequest("Invalid input", err)
	case errors.Is(err, errdefs.ErrUnauthorized):
		return huma.Error403Forbidden("Forbidden")
	case ent.IsNotFound(err) || errors.Is(err, errdefs.ErrNotFound):
		return huma.Error404NotFound("Not found", err)
	case errors.Is(err, errdefs.ErrConflict) ||
		errors.Is(err, errdefs.ErrGroupAlreadyExists) ||
		errors.Is(err, errdefs.ErrAlreadyBootstrapped) ||
		ent.IsConstraintError(err):
		return huma.Error409Conflict("Conflict", err)
	default:
		log.Error("Unhandled API error", "err", err)
		return huma.Error500InternalServerError("Internal server error")
	}
}
