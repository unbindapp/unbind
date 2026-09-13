package errdefs

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// ResponseError is the JSON body returned for every error response. The Type
// field is a stable, machine-readable code so clients can branch on the failure
// without parsing prose.
type ResponseError struct {
	Type      string   `json:"type" doc:"Stable, machine-readable error code" enum:"bad_request,unauthorized,forbidden,not_found,conflict,validation_error,rate_limited,internal_error,error" example:"not_found"`
	Status    int      `json:"status" doc:"HTTP status code" example:"404"`
	Message   string   `json:"message" doc:"Human-readable summary of what went wrong" example:"Project not found"`
	Details   []string `json:"details,omitempty" doc:"Optional actionable details, e.g. which field failed validation"`
	RequestID string   `json:"request_id,omitempty" doc:"Identifier of the request, quote it when reporting the failure so it can be found in the server logs" example:"api-7f9c4d2b-000042"`

	// cause is the underlying failure. It never reaches the client; it is logged
	// with the request context when the response is written.
	cause error
}

func (e *ResponseError) Error() string {
	return e.Message
}

func (e *ResponseError) GetStatus() int {
	return e.Status
}

// Cause returns the underlying failure, if the error carries one.
func (e *ResponseError) Cause() error {
	return e.cause
}

func (e *ResponseError) Unwrap() error {
	return e.cause
}

// errorCode maps an HTTP status to its stable machine-readable code.
func errorCode(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "bad_request"
	case http.StatusUnauthorized:
		return "unauthorized"
	case http.StatusForbidden:
		return "forbidden"
	case http.StatusNotFound:
		return "not_found"
	case http.StatusConflict:
		return "conflict"
	case http.StatusUnprocessableEntity:
		return "validation_error"
	case http.StatusTooManyRequests:
		return "rate_limited"
	case http.StatusInternalServerError:
		return "internal_error"
	default:
		return "error"
	}
}

// HumaErrorFunc is installed as huma.NewError so both framework-generated errors
// (validation, etc.) and handler errors share the ResponseError envelope.
var HumaErrorFunc = func(status int, message string, errs ...error) huma.StatusError {
	details := make([]string, 0, len(errs))
	for _, err := range errs {
		if detail := detailMessage(err); detail != "" {
			details = append(details, detail)
		}
	}
	return &ResponseError{
		Type:    errorCode(status),
		Status:  status,
		Message: message,
		Details: details,
	}
}

// WithCause attaches the underlying failure so the response writer can log it
// alongside the request id, method and path. The cause is never serialized.
func WithCause(err huma.StatusError, cause error) huma.StatusError {
	resp, ok := err.(*ResponseError)
	if !ok {
		return err
	}
	resp.cause = cause
	return resp
}

// detailMessage renders an error for the client-facing Details field. A CustomError carries an
// internal type prefix ("ErrInvalidInput: ...") that is noise to the caller, so only the message a
// handler actually wrote is surfaced.
func detailMessage(err error) string {
	if err == nil {
		return ""
	}
	var custom *CustomError
	if errors.As(err, &custom) {
		return custom.Message
	}
	return err.Error()
}

type ErrorType int

// Errors
var (
	ErrAlreadyBootstrapped = errors.New("already bootstrapped")
	// Permissions
	ErrUnauthorized       = errors.New("unauthorized")
	ErrGroupAlreadyExists = errors.New("group name already exists")
	ErrInvalidInput       = NewCustomError(ErrTypeInvalidInput, "")
	ErrNotFound           = NewCustomError(ErrTypeNotFound, "")
	ErrConflict           = NewCustomError(ErrTypeConflict, "")
)

// More dynamic errors
const (
	ErrTypeInvalidInput ErrorType = iota
	ErrTypeNotFound
	ErrTypeConflict
)

var errorTypeStrings = map[ErrorType]string{
	ErrTypeInvalidInput: "ErrInvalidInput",
	ErrTypeNotFound:     "ErrNotFound",
	ErrTypeConflict:     "ErrConflict",
}

func (e ErrorType) String() string {
	if s, ok := errorTypeStrings[e]; ok {
		return s
	}
	return "ErrUnknown"
}

// MaskAsNotFound converts an authorization failure into a not-found error so
// unviewable resources are indistinguishable from missing ones.
func MaskAsNotFound(err error, message string) error {
	if errors.Is(err, ErrUnauthorized) {
		return NewCustomError(ErrTypeNotFound, message)
	}
	return err
}

// InternalError names the step that failed in words the caller can act on,
// while keeping the raw failure for the logs. Use it instead of returning a
// bare wrapped error when a 500 is unavoidable, so the response says what broke
// rather than "Internal server error".
type InternalError struct {
	Summary string
	cause   error
}

func (e *InternalError) Error() string {
	if e.cause == nil {
		return e.Summary
	}
	return fmt.Sprintf("%s: %v", e.Summary, e.cause)
}

func (e *InternalError) Unwrap() error {
	return e.cause
}

// NewInternalError wraps cause with a caller-facing summary of the step that failed.
func NewInternalError(cause error, summary string) error {
	return &InternalError{Summary: summary, cause: cause}
}

type CustomError struct {
	Type    ErrorType
	Message string
}

func (e *CustomError) Error() string {
	return fmt.Sprintf("%s: %s", e.Type.String(), e.Message)
}

func (e *CustomError) Is(target error) bool {
	t, ok := target.(*CustomError)
	if !ok {
		return false
	}
	return e.Type == t.Type
}

func NewCustomError(t ErrorType, message string) *CustomError {
	return &CustomError{
		Type:    t,
		Message: message,
	}
}
