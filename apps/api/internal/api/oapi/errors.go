package oapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// StatusClientClosedRequest is nginx's code for "the caller hung up". It is not
// an IANA status and stays out of the documented responses: by the time it is
// written there is nobody left to read it. It exists so a cancelled request is
// not recorded as a server error.
const StatusClientClosedRequest = 499

// genericMessage is the last resort for a failure we could not classify.
const genericMessage = "Internal server error"

// MapError translates a domain error into the documented huma response. It is the
// single place that decides which HTTP status a given failure produces, so every
// handler reports errors consistently with the codes declared on each operation.
// Failures that are nobody's fault but ours carry the cause along for the logs
// (see errdefs.WithCause); the cause is never serialized into the response.
func MapError(err error) error {
	var internal *errdefs.InternalError

	summary := ""
	if errors.As(err, &internal) {
		summary = internal.Summary
	}

	return withSummary(classifyError(err), summary)
}

func classifyError(err error) error {
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
	case errors.Is(err, context.Canceled):
		return huma.NewError(StatusClientClosedRequest, "Request cancelled")
	case errors.Is(err, context.DeadlineExceeded):
		return errdefs.WithCause(huma.Error504GatewayTimeout("Timed out waiting for the cluster"), err)
	}

	if mapped, ok := mapKubernetesError(err); ok {
		return mapped
	}

	return errdefs.WithCause(huma.Error500InternalServerError(genericMessage), err)
}

// mapKubernetesError turns a Kubernetes API failure into the closest HTTP
// response, keeping the cluster's own message as a detail. Without this every
// RBAC denial, admission rejection or quota breach reaches the UI as a bare
// "Internal server error" with no way to tell which it was.
func mapKubernetesError(err error) (error, bool) {
	var status k8serrors.APIStatus
	if !errors.As(err, &status) {
		return nil, false
	}

	detail := errors.New(status.Status().Message)

	switch {
	case k8serrors.IsNotFound(err):
		return huma.Error404NotFound("Not found in the cluster", detail), true
	case k8serrors.IsForbidden(err):
		return huma.Error403Forbidden("The cluster denied this request", detail), true
	case k8serrors.IsUnauthorized(err):
		return errdefs.WithCause(huma.Error502BadGateway("The cluster rejected Unbind's credentials", detail), err), true
	case k8serrors.IsAlreadyExists(err) || k8serrors.IsConflict(err):
		return huma.Error409Conflict("The cluster already has a conflicting resource", detail), true
	case k8serrors.IsInvalid(err) || k8serrors.IsBadRequest(err) || k8serrors.IsRequestEntityTooLargeError(err):
		return huma.Error422UnprocessableEntity("The cluster rejected this configuration", detail), true
	case k8serrors.IsTooManyRequests(err):
		return huma.NewError(http.StatusTooManyRequests, "The cluster is rate limiting Unbind", detail), true
	case k8serrors.IsTimeout(err) || k8serrors.IsServerTimeout(err) || k8serrors.IsServiceUnavailable(err):
		return errdefs.WithCause(huma.Error504GatewayTimeout("The cluster did not respond in time", detail), err), true
	}

	return errdefs.WithCause(huma.Error502BadGateway("The cluster returned an error", detail), err), true
}

// withSummary puts the step that failed in the message, where the caller reads
// it. The classification it replaces is kept as a detail only when nothing more
// specific was found, so the reason never disappears.
func withSummary(mapped error, summary string) error {
	resp, ok := mapped.(*errdefs.ResponseError)
	if summary == "" || !ok {
		return mapped
	}

	if len(resp.Details) == 0 && resp.Message != "" && resp.Message != genericMessage {
		resp.Details = append(resp.Details, resp.Message)
	}
	resp.Message = summary
	return resp
}
