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

func TestValidateHostOptions(t *testing.T) {
	redirect := func(to string, status int) *schema.HostRedirect {
		return &schema.HostRedirect{To: to, StatusCode: status}
	}
	tests := []struct {
		name    string
		host    schema.HostSpec
		wantErr string
	}{
		{name: "www to apex", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com", 308)}},
		{name: "redirect to a path with the default status", host: schema.HostSpec{Host: "plugins.example.com", Redirect: redirect("https://example.com/plugins", 0)}},
		{name: "redirect without a scheme", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("example.com", 301)}, wantErr: "http or https"},
		{name: "redirect with a query", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com/?a=b", 301)}, wantErr: "query"},
		{name: "redirect to itself", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://WWW.example.com", 301)}, wantErr: "loop"},
		{name: "redirect to a path on itself", host: schema.HostSpec{Host: "example.com", Redirect: redirect("https://example.com/home", 301)}},
		{name: "unknown redirect status", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com", 303)}, wantErr: "301, 302, 307 or 308"},
		{name: "redirect with basic auth", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com", 301), BasicAuth: &schema.HostBasicAuth{Username: "admin"}}, wantErr: "redirect cannot have basic auth"},
		{name: "basic auth", host: schema.HostSpec{Host: "invoice.example.com", BasicAuth: &schema.HostBasicAuth{Username: "admin"}}},
		{name: "basic auth with a colon in the username", host: schema.HostSpec{Host: "invoice.example.com", BasicAuth: &schema.HostBasicAuth{Username: "ad:min"}}, wantErr: "username"},
		{name: "headers", host: schema.HostSpec{Host: "api.example.com", ResponseHeaders: []schema.HostHeader{
			{Name: "Cache-Control", Value: "public, max-age=600"},
			{Name: "Strict-Transport-Security", Value: "max-age=31536000; includeSubDomains"},
		}}},
		{name: "header name with a space", host: schema.HostSpec{Host: "api.example.com", ResponseHeaders: []schema.HostHeader{{Name: "Cache Control", Value: "no-store"}}}, wantErr: "letters, digits and dashes"},
		{name: "header listed twice", host: schema.HostSpec{Host: "api.example.com", ResponseHeaders: []schema.HostHeader{{Name: "X-A", Value: "1"}, {Name: "x-a", Value: "2"}}}, wantErr: "listed twice"},
		{name: "framing header", host: schema.HostSpec{Host: "api.example.com", ResponseHeaders: []schema.HostHeader{{Name: "Content-Length", Value: "0"}}}, wantErr: "cannot be set"},
		{name: "header value with a quote", host: schema.HostSpec{Host: "api.example.com", ResponseHeaders: []schema.HostHeader{{Name: "X-A", Value: `say "hi"`}}}, wantErr: "without quotes"},
		{name: "header value with a dollar", host: schema.HostSpec{Host: "api.example.com", ResponseHeaders: []schema.HostHeader{{Name: "X-A", Value: "$request_uri"}}}, wantErr: "dollar"},
		{name: "empty header value", host: schema.HostSpec{Host: "api.example.com", ResponseHeaders: []schema.HostHeader{{Name: "X-A", Value: ""}}}, wantErr: "needs a value"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateHostOptions(tt.host)
			if tt.wantErr == "" {
				assert.NoError(t, err)
				return
			}
			assert.ErrorContains(t, err, tt.wantErr)
		})
	}
}

func TestServiceURLSkipsRedirects(t *testing.T) {
	hosts := []schema.HostSpec{
		{Host: "*.example.com"},
		{Host: "www.example.com", Redirect: &schema.HostRedirect{To: "https://example.com"}},
		{Host: "example.com"},
	}
	url, ok := serviceURL(hosts)
	assert.True(t, ok)
	assert.Equal(t, "https://example.com", url)

	_, ok = serviceURL(hosts[:2])
	assert.False(t, ok)
}

func TestPrepareBasicAuth(t *testing.T) {
	saved := []schema.HostSpec{{Host: "invoice.example.com", BasicAuth: &schema.HostBasicAuth{Username: "admin", PasswordHash: "{SHA}saved"}}}

	t.Run("a typed password is hashed and never kept", func(t *testing.T) {
		hosts := []schema.HostSpec{{Host: "new.example.com", BasicAuth: &schema.HostBasicAuth{Username: "admin", Password: "secret"}}}
		assert.NoError(t, prepareBasicAuth(nil, hosts))
		assert.Equal(t, &schema.HostBasicAuth{Username: "admin", PasswordHash: schema.HashBasicAuthPassword("secret")}, hosts[0].BasicAuth)
		assert.Equal(t, "{SHA}5en6G6MezRroT3XKqkdPOmY/BfQ=", hosts[0].BasicAuth.PasswordHash)
	})

	t.Run("a left out password keeps the saved hash, through a rename too", func(t *testing.T) {
		hosts := []schema.HostSpec{{Host: "bills.example.com", PrevHost: new("invoice.example.com"), BasicAuth: &schema.HostBasicAuth{Username: "finance"}}}
		assert.NoError(t, prepareBasicAuth(saved, hosts))
		assert.Equal(t, &schema.HostBasicAuth{Username: "finance", PasswordHash: "{SHA}saved"}, hosts[0].BasicAuth)
	})

	t.Run("a client cannot smuggle a hash in", func(t *testing.T) {
		hosts := []schema.HostSpec{{Host: "invoice.example.com", BasicAuth: &schema.HostBasicAuth{Username: "admin", PasswordHash: "{SHA}forged"}}}
		assert.NoError(t, prepareBasicAuth(saved, hosts))
		assert.Equal(t, "{SHA}saved", hosts[0].BasicAuth.PasswordHash)
	})

	t.Run("a domain without a saved password needs one", func(t *testing.T) {
		hosts := []schema.HostSpec{{Host: "new.example.com", BasicAuth: &schema.HostBasicAuth{Username: "admin"}}}
		assert.ErrorContains(t, prepareBasicAuth(saved, hosts), "enter a password")
	})
}

func TestRedactedHosts(t *testing.T) {
	hosts := []schema.HostSpec{{Host: "invoice.example.com", BasicAuth: &schema.HostBasicAuth{Username: "admin", Password: "typed", PasswordHash: "{SHA}saved"}}}
	redacted := schema.RedactedHosts(hosts)
	assert.Equal(t, &schema.HostBasicAuth{Username: "admin"}, redacted[0].BasicAuth)
	assert.Equal(t, "{SHA}saved", hosts[0].BasicAuth.PasswordHash, "the stored hosts are left alone")
}
