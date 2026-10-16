package permissions_repo

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

type checkStub struct {
	PermissionsRepositoryInterface
	calls []PermissionCheck
	role  entSchema.PermittedAction
	err   error
}

func (s *checkStub) Check(ctx context.Context, _ uuid.UUID, checks []PermissionCheck) error {
	s.calls = append(s.calls, checks...)
	if access, limited := APIKeyAccessFromContext(ctx); limited {
		s.role = access.Role
	}
	return s.err
}

func TestCanReadSecrets(t *testing.T) {
	envID := uuid.New()
	viewerKey := APIKeyAccess{Role: entSchema.ActionViewer, FullAccess: true}
	readingKey := APIKeyAccess{Role: entSchema.ActionViewer, FullAccess: true, Privileges: []entSchema.KeyPrivilege{entSchema.PrivilegeReadVariableValues}}

	tests := []struct {
		name       string
		ctx        context.Context
		checkErr   error
		want       bool
		wantChecks int
		wantRole   entSchema.PermittedAction
	}{
		{"session with editor", context.Background(), nil, true, 1, ""},
		{"session without editor", context.Background(), errdefs.ErrUnauthorized, false, 1, ""},
		{"key without the privilege never asks", WithAPIKeyAccess(context.Background(), viewerKey), nil, false, 0, ""},
		{"key with the privilege is checked as editor", WithAPIKeyAccess(context.Background(), readingKey), nil, true, 1, entSchema.ActionEditor},
		{"key with the privilege but owner without editor", WithAPIKeyAccess(context.Background(), readingKey), errdefs.ErrUnauthorized, false, 1, entSchema.ActionEditor},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stub := &checkStub{err: tt.checkErr}
			got, err := CanReadSecrets(tt.ctx, stub, uuid.New(), entSchema.PrivilegeReadVariableValues, entSchema.ResourceTypeEnvironment, envID)
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
			require.Len(t, stub.calls, tt.wantChecks)
			if tt.wantChecks > 0 {
				assert.Equal(t, PermissionCheck{Action: entSchema.ActionEditor, ResourceType: entSchema.ResourceTypeEnvironment, ResourceID: envID}, stub.calls[0])
			}
			assert.Equal(t, tt.wantRole, stub.role)
		})
	}
}

func TestCanReadSecretsReturnsOtherErrors(t *testing.T) {
	boom := errors.New("db down")
	got, err := CanReadSecrets(context.Background(), &checkStub{err: boom}, uuid.New(), entSchema.PrivilegeReadVariableValues, entSchema.ResourceTypeEnvironment, uuid.New())
	assert.ErrorIs(t, err, boom)
	assert.False(t, got)
}
