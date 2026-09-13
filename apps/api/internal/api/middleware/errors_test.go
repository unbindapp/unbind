package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

func contextWithRequestID(t *testing.T, id string) huma.Context {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/services/create", nil)
	if id != "" {
		req = req.WithContext(context.WithValue(req.Context(), RequestIDKey, id))
	}
	return humatest.NewContext(&huma.Operation{Method: http.MethodPost, Path: "/services/create"}, req, httptest.NewRecorder())
}

func TestErrorTransformerStampsRequestID(t *testing.T) {
	resp := errdefs.HumaErrorFunc(500, "Failed to save the service").(*errdefs.ResponseError)

	out, err := ErrorTransformer(contextWithRequestID(t, "api/abc-000042"), "500", resp)
	if err != nil {
		t.Fatalf("ErrorTransformer returned %v", err)
	}
	if got := out.(*errdefs.ResponseError).RequestID; got != "api/abc-000042" {
		t.Fatalf("request id = %q, want the id from the request context", got)
	}
}

func TestErrorTransformerLeavesSuccessBodiesAlone(t *testing.T) {
	body := struct{ Name string }{Name: "unchanged"}

	out, err := ErrorTransformer(contextWithRequestID(t, "api/abc-000042"), "200", body)
	if err != nil {
		t.Fatalf("ErrorTransformer returned %v", err)
	}
	if out.(struct{ Name string }).Name != "unchanged" {
		t.Fatalf("transformer modified a non-error body: %v", out)
	}
}

func TestErrorTransformerWithoutRequestID(t *testing.T) {
	resp := errdefs.HumaErrorFunc(404, "Not found").(*errdefs.ResponseError)

	out, err := ErrorTransformer(contextWithRequestID(t, ""), "404", resp)
	if err != nil {
		t.Fatalf("ErrorTransformer returned %v", err)
	}
	if got := out.(*errdefs.ResponseError).RequestID; got != "" {
		t.Fatalf("request id = %q, want empty when the middleware did not run", got)
	}
}
