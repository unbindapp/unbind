package system_handler

import (
	"context"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	system_repo "github.com/unbindapp/unbind-api/internal/repositories/system"
	system_service "github.com/unbindapp/unbind-api/internal/services/system"
)

type SettingsUpdateInput struct {
	server.BaseAuthInput
	Body *system_repo.SystemSettingUpdateInput
}

type SettingsResponse struct {
	Body struct {
		Data *system_service.SystemSettingsResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) UpdateBuildkitSettings(ctx context.Context, input *SettingsUpdateInput) (*SettingsResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	if input.Body.WildcardDomain != nil {
		// Validate the domain
		baseDomain := strings.ReplaceAll(*input.Body.WildcardDomain, "https://", "")
		baseDomain = strings.ReplaceAll(baseDomain, "http://", "")
		baseDomain = strings.ReplaceAll(baseDomain, "*.", "")

		// Get IP
		ips, err := self.srv.KubeClient.GetIngressNginxIP(ctx)
		if err != nil {
			log.Error("Error getting ingress nginx IP", "err", err)
			return nil, huma.Error500InternalServerError("Error getting ingress nginx IP")
		}

		resolved, err := self.srv.DNSChecker.IsPointingToIP(baseDomain, ips.IPv4)
		if err != nil {
			log.Error("Error checking DNS", "err", err)
			return nil, huma.Error500InternalServerError("Error checking DNS")
		}
		if !resolved {
			resolved, err = self.srv.DNSChecker.IsPointingToIP(baseDomain, ips.IPv6)
			if err != nil {
				log.Error("Error checking DNS", "err", err)
				return nil, huma.Error500InternalServerError("Error checking DNS")
			}
		}
		if !resolved {
			resolved, err = self.srv.DNSChecker.IsUsingCloudflareProxy(baseDomain)
			if err != nil {
				log.Error("Error checking Cloudflare", "err", err)
				return nil, huma.Error500InternalServerError("Error checking Cloudflare")
			}
		}

		if !resolved {
			return nil, huma.Error400BadRequest("Wildcard domain does not have DNS configured")
		}

		input.Body.WildcardDomain = utils.ToPtr(baseDomain)
	}

	settings, err := self.srv.SystemService.UpdateSettings(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}
	resp := &SettingsResponse{}
	resp.Body.Data = settings
	return resp, nil
}
