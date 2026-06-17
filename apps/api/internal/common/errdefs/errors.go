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
	Type    string   `json:"type" doc:"Stable, machine-readable error code" enum:"bad_request,unauthorized,forbidden,not_found,conflict,validation_error,rate_limited,internal_error,error" example:"not_found"`
	Status  int      `json:"status" doc:"HTTP status code" example:"404"`
	Message string   `json:"message" doc:"Human-readable summary of what went wrong" example:"Project not found"`
	Details []string `json:"details,omitempty" doc:"Optional actionable details, e.g. which field failed validation"`
}

func (e *ResponseError) Error() string {
	return e.Message
}

func (e *ResponseError) GetStatus() int {
	return e.Status
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
		if err != nil {
			details = append(details, err.Error())
		}
	}
	return &ResponseError{
		Type:    errorCode(status),
		Status:  status,
		Message: message,
		Details: details,
	}
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
