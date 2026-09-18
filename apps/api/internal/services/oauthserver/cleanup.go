package oauthserver_service

import (
	"context"

	"github.com/hashicorp/go-multierror"
)

// Cleanup drops what nothing can use any more: expired codes, retired or expired
// tokens, and registrations that never led to a grant.
func (self *OAuthServerService) Cleanup(ctx context.Context) (result error) {
	now := self.now()
	repo := self.repo.OAuthServer()
	if _, err := repo.DeleteCodesExpiredBefore(ctx, now); err != nil {
		result = multierror.Append(result, err)
	}
	if _, err := repo.DeleteTokensExpiredOrUsedBefore(ctx, now.Add(-retiredTokenKeep)); err != nil {
		result = multierror.Append(result, err)
	}
	if _, err := repo.DeleteOrphanClientsBefore(ctx, now.Add(-orphanClientKeep)); err != nil {
		result = multierror.Append(result, err)
	}
	if err := self.repo.Oauth().CleanTokenStore(ctx); err != nil {
		result = multierror.Append(result, err)
	}
	return result
}
