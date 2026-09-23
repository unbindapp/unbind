package middleware

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func mcpContext(h *apiKeyHarness, access permissions_repo.APIKeyAccess) context.Context {
	return apictx.WithMCPCaller(context.Background(), &apictx.MCPCaller{User: h.user, Access: access, Via: "test"})
}

func TestMCPCallerGetsNarrowedIdentityWithoutCredentials(t *testing.T) {
	h := newAPIKeyHarness(t)
	access := permissions_repo.APIKeyAccess{Role: schema.ActionEditor, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeProject, ResourceID: uuid.New()}}}

	resp := h.api.PostCtx(mcpContext(h, access), "/v1/write")
	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", resp.Code, resp.Body.String())
	}
	if h.last == nil || h.last.userID != h.user.ID {
		t.Fatal("handler did not see the verified caller")
	}
	if h.last.hasBearer {
		t.Fatal("an MCP caller must never populate the bearer token used for Kubernetes identity")
	}
	if !h.last.scoped || h.last.access.FullAccess || len(h.last.access.Resources) != 1 {
		t.Fatalf("access %+v is not the caller's", h.last.access)
	}
}

func TestMCPCallerIsHeldToAPIKeyRules(t *testing.T) {
	h := newAPIKeyHarness(t)
	admin := permissions_repo.APIKeyAccess{Role: schema.ActionAdmin, FullAccess: true}
	viewer := permissions_repo.APIKeyAccess{Role: schema.ActionViewer, FullAccess: true}

	if resp := h.api.GetCtx(mcpContext(h, admin), "/v1/secret"); resp.Code != http.StatusForbidden {
		t.Fatalf("session only operation: status = %d, want 403", resp.Code)
	}
	if resp := h.api.PostCtx(mcpContext(h, viewer), "/v1/write"); resp.Code != http.StatusForbidden {
		t.Fatalf("read only caller on a write: status = %d, want 403", resp.Code)
	}
	if resp := h.api.GetCtx(mcpContext(h, admin), "/v1/logs"); resp.Code != http.StatusForbidden {
		t.Fatalf("caller without the read_logs privilege: status = %d, want 403", resp.Code)
	}
	if h.last != nil {
		t.Fatal("a handler ran for a refused MCP caller")
	}
}

func TestMCPCallerWithoutUserIsIgnored(t *testing.T) {
	h := newAPIKeyHarness(t)
	ctx := apictx.WithMCPCaller(context.Background(), &apictx.MCPCaller{})

	if resp := h.api.GetCtx(ctx, "/v1/read"); resp.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.Code)
	}
}
