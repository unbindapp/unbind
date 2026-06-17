package system_handler

import (
	"context"
	"fmt"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

type GenerateWildcardDomainInput struct {
	server.BaseAuthInput
	Body struct {
		Name string `json:"name" doc:"The base name of the wildcard domain" required:"true" minLength:"1"`
	}
}

type GenerateWildcardDomainOutput struct {
	Body struct {
		Data string `json:"data" doc:"The generated wildcard domain"`
	}
}

func (self *HandlerGroup) GenerateWildcardDomain(ctx context.Context, input *GenerateWildcardDomainInput) (output *GenerateWildcardDomainOutput, err error) {
	settings, err := self.srv.Repository.System().GetSystemSettings(ctx, nil)
	if err != nil {
		log.Error("failed to get system settings", "error", err)
		return nil, huma.Error500InternalServerError("An unknown error occured")
	}

	if settings.WildcardBaseURL == nil || *settings.WildcardBaseURL == "" {
		return nil, huma.Error400BadRequest("No wildcard base URL configured")
	}

	// Generate a slug
	slug, err := utils.GenerateSlug(input.Body.Name)
	if err != nil {
		log.Error("failed to generate slug", "error", err)
		return nil, huma.Error400BadRequest("Invalid name")
	}

	// Generate the wildcard domain
	domain, err := utils.GenerateSubdomain(slug, *settings.WildcardBaseURL)
	if err != nil {
		log.Error("failed to generate subdomain", "error", err)
		return nil, huma.Error400BadRequest("Invalid name")
	}

	// Check for collisions
	domainCount, err := self.srv.Repository.Service().CountDomainCollisons(ctx, nil, domain, nil)
	if err != nil {
		log.Error("failed to count domain collisions", "error", err)
		return nil, huma.Error500InternalServerError("An unknown error occured")
	}

	if domainCount > 0 {
		domain, err = utils.GenerateSubdomain(fmt.Sprintf("%s-%d", slug, domainCount), *settings.WildcardBaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to generate subdomain with suffix: %w", err)
		}
	}

	output = &GenerateWildcardDomainOutput{}
	output.Body.Data = domain
	return output, nil
}

// * Check collision
type CheckUniqueDomainInput struct {
	server.BaseAuthInput
	domain string `query:"domain" required:"true" description:"Domain to check for uniqueness"`
}

type CollisionOutput struct {
	IsUnique bool `json:"is_unique" doc:"True if the domain is unique, false otherwise"`
}

type CheckUniqueDomainOutput struct {
	Body struct {
		Data *CollisionOutput `json:"data" doc:"The generated wildcard domain"  nullable:"false"`
	}
}

func (self *HandlerGroup) CheckForDomainCollision(ctx context.Context, input *CheckUniqueDomainInput) (output *CheckUniqueDomainOutput, err error) {
	// Sanitize and clean
	cleanedDomain, err := utils.CleanAndValidateHost(input.domain)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid domain")
	}

	// Check for collisions
	domainCount, err := self.srv.Repository.Service().CountDomainCollisons(ctx, nil, cleanedDomain, nil)
	if err != nil {
		log.Error("failed to count domain collisions", "error", err)
		return nil, huma.Error500InternalServerError("An unknown error occured")
	}

	output = &CheckUniqueDomainOutput{}
	output.Body.Data = &CollisionOutput{
		IsUnique: domainCount == 0,
	}
	return output, nil
}
