package github

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

func (self *GithubClient) ReadUserAdminOrganizations(ctx context.Context, installation *ent.GithubInstallation) ([]*github.Organization, error) {
	if installation == nil || installation.AccountType != githubinstallation.AccountTypeUser || installation.Edges.GithubApp == nil {
		return nil, fmt.Errorf("invalid installation")
	}

	authenticatedClient, err := self.GetAuthenticatedClient(ctx, installation.GithubAppID, installation.ID, installation.Edges.GithubApp.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("error getting authenticated client: %v", err)
	}

	orgs, _, err := authenticatedClient.Organizations.ListOrgMemberships(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("error getting user organizations: %v", err)
	}

	adminOrgs := make([]*github.Organization, 0)
	for _, org := range orgs {
		membership, _, err := authenticatedClient.Organizations.GetOrgMembership(ctx, installation.AccountLogin, org.Organization.GetLogin())
		if err != nil {
			log.Errorf("Error getting membership for org %s: %v", org.Organization.GetLogin(), err)
			continue
		}
		if strings.EqualFold(membership.GetRole(), "admin") {
			adminOrgs = append(adminOrgs, org.Organization)
		}
	}
	return adminOrgs, nil
}
