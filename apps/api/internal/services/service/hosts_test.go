package service_service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
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

func TestValidateHostsProxyNeedsGateway(t *testing.T) {
	hosts := []schema.HostSpec{{Host: "install.example.com", Proxy: &schema.HostProxy{To: "https://example.net/install.sh"}}}
	for provider, wantErr := range map[string]string{"gateway": "", "nginx": "gateway networking provider", "traefik": "gateway networking provider"} {
		t.Run(provider, func(t *testing.T) {
			k8s := mocks_infrastructure_k8s.NewKubeClientMock(t)
			k8s.EXPECT().NetworkingProvider(mock.Anything).Return(provider)
			service := &ServiceService{k8s: k8s}
			err := service.validateHosts(context.Background(), nil, hosts)
			if wantErr == "" {
				assert.NoError(t, err)
				return
			}
			assert.ErrorContains(t, err, wantErr)
		})
	}
}

func TestValidateHostPath(t *testing.T) {
	tests := []struct {
		path    string
		grpc    bool
		wantErr string
	}{
		{path: ""},
		{path: "/"},
		{path: "/api"},
		{path: "/api/"},
		{path: "/socket.io"},
		{path: "/.well-known/acme"},
		{path: "/blog/v1.2-release"},
		{path: "", grpc: true},
		{path: "/api", grpc: true, wantErr: "grpc domain answers on every path"},
		{path: "api", wantErr: "start with /"},
		{path: "/a//b", wantErr: "between single slashes"},
		{path: "/a/../b", wantErr: "between single slashes"},
		{path: "/a/.", wantErr: "between single slashes"},
		{path: "/a b", wantErr: "between single slashes"},
		{path: "/a%2Fb", wantErr: "between single slashes"},
		{path: "/a?b", wantErr: "between single slashes"},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			host := schema.HostSpec{Host: "example.com", Path: tt.path}
			if tt.grpc {
				host.Protocol = new(schema.HostProtocolGRPC)
			}
			err := validateHostPath(host)
			if tt.wantErr == "" {
				assert.NoError(t, err)
				return
			}
			assert.ErrorContains(t, err, tt.wantErr)
		})
	}
}

func TestDuplicateRoute(t *testing.T) {
	_, ok := duplicateRoute([]schema.HostSpec{{Host: "example.com"}, {Host: "example.com", Path: "/api"}, {Host: "www.example.com"}})
	assert.False(t, ok)

	route, ok := duplicateRoute([]schema.HostSpec{{Host: "example.com", Path: "/api"}, {Host: "Example.com", Path: "/api/"}})
	assert.True(t, ok)
	assert.Equal(t, "Example.com/api", route)

	route, ok = duplicateRoute([]schema.HostSpec{{Host: "example.com"}, {Host: "example.com", Path: "/"}})
	assert.True(t, ok)
	assert.Equal(t, "example.com", route)
}

func TestValidateHostOptions(t *testing.T) {
	redirect := func(to string, status int) *schema.HostRedirect {
		return &schema.HostRedirect{To: to, StatusCode: status}
	}
	proxy := func(to string) *schema.HostProxy {
		return &schema.HostProxy{To: to}
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
		{name: "redirect to a versioned path with a trailing slash", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com/docs/v1.2/", 301)}},
		{name: "redirect path with nginx directives", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com/x%3B%0A%7D%0Alocation%20/leak%20%7B%20alias%20/var/run/secrets/%3B%20%7D%0Alocation%20/y%20%7B%23", 301)}, wantErr: "redirect path"},
		{name: "redirect path with a space", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com/a%20b", 301)}, wantErr: "redirect path"},
		{name: "redirect path with a dollar sign", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com/$1", 301)}, wantErr: "redirect path"},
		{name: "redirect path with a quote", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com/a'b", 301)}, wantErr: "redirect path"},
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
		{name: "proxy to a host that is a listed suffix", host: schema.HostSpec{Host: "echo.example.com", Proxy: proxy("https://httpbin.org/anything")}},
		{name: "proxy to a file", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("https://raw.githubusercontent.com/org/repo/main/install.sh")}},
		{name: "proxy to a port with basic auth", host: schema.HostSpec{Host: "legacy.example.com", Proxy: proxy("http://Legacy.Example.net:8080"), BasicAuth: &schema.HostBasicAuth{Username: "admin"}}},
		{name: "proxy and redirect", host: schema.HostSpec{Host: "www.example.com", Redirect: redirect("https://example.com", 308), Proxy: proxy("https://example.net")}, wantErr: "not both"},
		{name: "grpc proxy", host: schema.HostSpec{Host: "api.example.com", Protocol: new(schema.HostProtocolGRPC), Proxy: proxy("https://example.net")}, wantErr: "not grpc"},
		{name: "proxy without a scheme", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("example.net/install.sh")}, wantErr: "http or https"},
		{name: "proxy with a query", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("https://example.net/?a=b")}, wantErr: "query"},
		{name: "proxy with credentials", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("https://user:pass@example.net")}, wantErr: "credentials"},
		{name: "proxy port out of range", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("https://example.net:70000")}, wantErr: "between 1 and 65535"},
		{name: "proxy to itself", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("https://install.example.com/other")}, wantErr: "loop"},
		{name: "proxy path with a space", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("https://example.net/a%20b")}, wantErr: "path"},
		{name: "proxy to an IP", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("http://10.43.0.1")}, wantErr: "public hostname"},
		{name: "proxy to the metadata address", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("http://169.254.169.254/latest")}, wantErr: "public hostname"},
		{name: "proxy to localhost", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("http://localhost:8080")}, wantErr: "public hostname"},
		{name: "proxy to a cluster service", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("http://postgres.team.svc.cluster.local:5432")}, wantErr: "public hostname"},
		{name: "proxy to a service by namespace", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("https://kubernetes.default")}, wantErr: "public hostname"},
		{name: "proxy to an internal name", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("http://metadata.google.internal")}, wantErr: "public hostname"},
		{name: "proxy to an underscore name", host: schema.HostSpec{Host: "install.example.com", Proxy: proxy("https://my_host.example.com")}, wantErr: "public hostname"},
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

func TestServiceURLSkipsRedirectsAndProxies(t *testing.T) {
	hosts := []schema.HostSpec{
		{Host: "*.example.com"},
		{Host: "www.example.com", Redirect: &schema.HostRedirect{To: "https://example.com"}},
		{Host: "install.example.com", Proxy: &schema.HostProxy{To: "https://example.net/install.sh"}},
		{Host: "example.com"},
	}
	url, ok := serviceURL(hosts)
	assert.True(t, ok)
	assert.Equal(t, "https://example.com", url)

	_, ok = serviceURL(hosts[:3])
	assert.False(t, ok)

	url, ok = serviceURL([]schema.HostSpec{{Host: "example.com", Path: "/inquire/"}})
	assert.True(t, ok)
	assert.Equal(t, "https://example.com/inquire", url)
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

	t.Run("the saved hash belongs to the domain on the same path", func(t *testing.T) {
		split := []schema.HostSpec{{Host: "example.com"}, {Host: "example.com", Path: "/admin", BasicAuth: &schema.HostBasicAuth{Username: "admin", PasswordHash: "{SHA}saved"}}}
		kept := []schema.HostSpec{{Host: "example.com", Path: "/admin/", BasicAuth: &schema.HostBasicAuth{Username: "admin"}}}
		assert.NoError(t, prepareBasicAuth(split, kept))
		assert.Equal(t, "{SHA}saved", kept[0].BasicAuth.PasswordHash)

		moved := []schema.HostSpec{{Host: "example.com", Path: "/staff", PrevPath: new("/admin"), BasicAuth: &schema.HostBasicAuth{Username: "admin"}}}
		assert.NoError(t, prepareBasicAuth(split, moved))
		assert.Equal(t, "{SHA}saved", moved[0].BasicAuth.PasswordHash)

		root := []schema.HostSpec{{Host: "example.com", BasicAuth: &schema.HostBasicAuth{Username: "admin"}}}
		assert.ErrorContains(t, prepareBasicAuth(split, root), "enter a password")
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
