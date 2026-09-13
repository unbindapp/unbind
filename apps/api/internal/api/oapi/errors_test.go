package oapi

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// The envelope is installed by router.NewHumaConfig at startup; tests exercise
// MapError directly, so install it here too.
func init() {
	huma.NewError = errdefs.HumaErrorFunc
}

var podResource = schema.GroupResource{Group: "", Resource: "pods"}

func mapped(t *testing.T, err error) *errdefs.ResponseError {
	t.Helper()
	resp, ok := MapError(err).(*errdefs.ResponseError)
	if !ok {
		t.Fatalf("MapError(%v) did not return a ResponseError", err)
	}
	return resp
}

func TestMapErrorStatuses(t *testing.T) {
	tests := map[string]struct {
		err     error
		status  int
		message string
	}{
		"invalid input": {
			err:     errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "bad port"),
			status:  400,
			message: "Invalid input",
		},
		"not found": {
			err:     errdefs.NewCustomError(errdefs.ErrTypeNotFound, "no service"),
			status:  404,
			message: "Not found",
		},
		"cancelled by the caller": {
			err:     fmt.Errorf("listing pods: %w", context.Canceled),
			status:  StatusClientClosedRequest,
			message: "Request cancelled",
		},
		"deadline exceeded": {
			err:     fmt.Errorf("listing pods: %w", context.DeadlineExceeded),
			status:  504,
			message: "Timed out waiting for the cluster",
		},
		"kubernetes forbidden": {
			err:     k8serrors.NewForbidden(podResource, "api", errors.New("no permission")),
			status:  403,
			message: "The cluster denied this request",
		},
		"kubernetes not found": {
			err:     k8serrors.NewNotFound(podResource, "api"),
			status:  404,
			message: "Not found in the cluster",
		},
		"kubernetes already exists": {
			err:     k8serrors.NewAlreadyExists(podResource, "api"),
			status:  409,
			message: "The cluster already has a conflicting resource",
		},
		"kubernetes invalid": {
			err:     k8serrors.NewInvalid(schema.GroupKind{Kind: "Pod"}, "api", nil),
			status:  422,
			message: "The cluster rejected this configuration",
		},
		"kubernetes rate limited": {
			err:     k8serrors.NewTooManyRequests("slow down", 1),
			status:  429,
			message: "The cluster is rate limiting Unbind",
		},
		"kubernetes unavailable": {
			err:     k8serrors.NewServiceUnavailable("apiserver is down"),
			status:  504,
			message: "The cluster did not respond in time",
		},
		"kubernetes other": {
			err:     k8serrors.NewInternalError(errors.New("etcd exploded")),
			status:  502,
			message: "The cluster returned an error",
		},
		"unclassified": {
			err:     errors.New("something went sideways"),
			status:  500,
			message: "Internal server error",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			resp := mapped(t, tc.err)
			if resp.Status != tc.status {
				t.Fatalf("status = %d, want %d", resp.Status, tc.status)
			}
			if resp.Message != tc.message {
				t.Fatalf("message = %q, want %q", resp.Message, tc.message)
			}
		})
	}
}

func TestMapErrorNilPassesThrough(t *testing.T) {
	if err := MapError(nil); err != nil {
		t.Fatalf("MapError(nil) = %v, want nil", err)
	}
}

func TestMapErrorKeepsClusterMessageAsDetail(t *testing.T) {
	err := k8serrors.NewForbidden(podResource, "api", errors.New("RBAC: denied"))

	resp := mapped(t, err)
	if len(resp.Details) != 1 {
		t.Fatalf("details = %v, want the cluster message", resp.Details)
	}
	if resp.Details[0] != err.Error() {
		t.Fatalf("detail = %q, want %q", resp.Details[0], err.Error())
	}
}

func TestMapErrorInternalSummaryKeepsClassificationWhenNothingElseSaysWhy(t *testing.T) {
	err := errdefs.NewInternalError(context.DeadlineExceeded, "Failed to save the service")

	resp := mapped(t, err)
	if resp.Status != 504 {
		t.Fatalf("status = %d, want 504", resp.Status)
	}
	if len(resp.Details) != 1 || resp.Details[0] != "Timed out waiting for the cluster" {
		t.Fatalf("details = %v, want the classification that was replaced", resp.Details)
	}
}

func TestMapErrorInternalSummaryNamesTheStep(t *testing.T) {
	cause := errors.New("connection refused")
	err := errdefs.NewInternalError(cause, "Failed to save the service")

	resp := mapped(t, err)
	if resp.Status != 500 {
		t.Fatalf("status = %d, want 500", resp.Status)
	}
	if resp.Message != "Failed to save the service" {
		t.Fatalf("message = %q, want the summary", resp.Message)
	}
	if !errors.Is(resp.Cause(), cause) {
		t.Fatalf("cause = %v, want %v", resp.Cause(), cause)
	}
	if len(resp.Details) != 0 {
		t.Fatalf("details = %v, want none for an unclassified failure", resp.Details)
	}
}

func TestMapErrorInternalSummaryKeepsClusterClassification(t *testing.T) {
	cause := k8serrors.NewForbidden(podResource, "api", errors.New("RBAC: denied"))
	err := errdefs.NewInternalError(cause, "Failed to create the service's secret in the cluster")

	resp := mapped(t, err)
	if resp.Status != 403 {
		t.Fatalf("status = %d, want 403 from the cluster error", resp.Status)
	}
	if resp.Message != "Failed to create the service's secret in the cluster" {
		t.Fatalf("message = %q, want the summary", resp.Message)
	}
	if len(resp.Details) != 1 || resp.Details[0] != cause.Error() {
		t.Fatalf("details = %v, want just the cluster's own message", resp.Details)
	}
}

func TestMapErrorKubernetesStatusMessageIsReadable(t *testing.T) {
	status := &metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    403,
		Reason:  metav1.StatusReasonForbidden,
		Message: `secrets is forbidden: User "system:serviceaccount:unbind-system:unbind-api" cannot create resource "secrets"`,
	}
	err := fmt.Errorf("creating secret: %w", &k8serrors.StatusError{ErrStatus: *status})

	resp := mapped(t, err)
	if resp.Status != 403 {
		t.Fatalf("status = %d, want 403", resp.Status)
	}
	if resp.Details[0] != status.Message {
		t.Fatalf("detail = %q, want the cluster's own message", resp.Details[0])
	}
}
