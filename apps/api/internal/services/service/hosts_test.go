package service_service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_system "github.com/unbindapp/unbind-api/mocks/repository/system"
)

func TestValidateHosts(t *testing.T) {
	repo := mocks_repositories.NewRepositoriesMock(t)
	system := mocks_repository_system.NewSystemRepositoryMock(t)
	repo.EXPECT().System().Return(system).Maybe()
	system.EXPECT().GetSystemSettings(mock.Anything, mock.Anything).
		Return(&ent.SystemSetting{WildcardBaseURL: new("apps.unbind.example.com")}, nil).Maybe()

	service := &ServiceService{
		repo: repo,
		cfg: &config.Config{
			ExternalUIUrl:  "https://unbind.example.com",
			ExternalAPIURL: "https://unbind.example.com/api",
		},
	}

	tests := []struct {
		host    string
		wantErr string
	}{
		{host: "app.customer.com"},
		{host: "*.customer.com"},
		{host: "my-service.apps.unbind.example.com"},
		{host: "*.my-service.apps.unbind.example.com"},
		{host: "*.other.example.com"},
		{host: "*.com", wantErr: "invalid domain"},
		{host: "not a domain", wantErr: "invalid domain"},
		{host: "*.apps.unbind.example.com", wantErr: "is reserved"},
		{host: "*.unbind.example.com", wantErr: "is reserved"},
		{host: "*.example.com", wantErr: "is reserved"},
	}
	for _, tt := range tests {
		t.Run(tt.host, func(t *testing.T) {
			err := service.validateHosts(context.Background(), nil, []schema.HostSpec{{Host: tt.host}})
			if tt.wantErr == "" {
				assert.NoError(t, err)
				return
			}
			assert.ErrorContains(t, err, tt.wantErr)
		})
	}
}
