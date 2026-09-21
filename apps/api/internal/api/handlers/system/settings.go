package system_handler

import (
	"context"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	system_service "github.com/unbindapp/unbind-api/internal/services/system"
)

type SettingsUpdateInput struct {
	server.BaseAuthInput
	Body *system_service.SystemSettingsUpdateInput
}

type SettingsResponse struct {
	Body struct {
		Data *system_service.SystemSettingsResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) UpdateSettings(ctx context.Context, input *SettingsUpdateInput) (*SettingsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if domain := input.Body.WildcardDomain; domain != nil && *domain != "" {
		baseDomain, err := self.verifyWildcardDomainDNS(ctx, *domain)
		if err != nil {
			return nil, err
		}
		input.Body.WildcardDomain = &baseDomain
	}

	settings, err := self.srv.SystemService.UpdateSettings(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}
	resp := &SettingsResponse{}
	resp.Body.Data = settings
	return resp, nil
}

func (self *HandlerGroup) verifyWildcardDomainDNS(ctx context.Context, domain string) (string, error) {
	baseDomain := strings.ReplaceAll(domain, "https://", "")
	baseDomain = strings.ReplaceAll(baseDomain, "http://", "")
	baseDomain = strings.ReplaceAll(baseDomain, "*.", "")

	ips, err := self.srv.KubeClient.GetIngressNginxIP(ctx)
	if err != nil {
		return "", oapi.MapError(errdefs.NewInternalError(err, "Failed to look up the ingress IP"))
	}

	resolved, err := self.srv.DNSChecker.IsPointingToIP(baseDomain, ips.IPv4)
	if err != nil {
		return "", oapi.MapError(errdefs.NewInternalError(err, "Failed to check the domain's DNS records"))
	}
	if !resolved {
		resolved, err = self.srv.DNSChecker.IsPointingToIP(baseDomain, ips.IPv6)
		if err != nil {
			return "", oapi.MapError(errdefs.NewInternalError(err, "Failed to check the domain's DNS records"))
		}
	}
	if !resolved {
		resolved, err = self.srv.DNSChecker.IsUsingCloudflareProxy(baseDomain)
		if err != nil {
			log.Warnf("Error checking Cloudflare for wildcard domain %s: %v", baseDomain, err)
		}
	}
	if !resolved {
		return "", huma.Error400BadRequest("Wildcard domain does not have DNS configured")
	}

	return baseDomain, nil
}
