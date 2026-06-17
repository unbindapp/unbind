package github

import (
	"context"
	"fmt"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

func (self *GithubClient) ReadUserAdminOrganizations(ctx context.Context, installation *ent.GithubInstallation) ([]*github.Organization, error) {
	if installation == nil || installation.AccountType != githubinstallation.AccountTypeUser || installation.Edges.GithubApp == nil {
		return nil, fmt.Errorf("invalid installation")
	}

	// Get authenticated client
	authenticatedClient, err := self.GetAuthenticatedClient(ctx, installation.GithubAppID, installation.ID, installation.Edges.GithubApp.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("error getting authenticated client: %v", err)
	}

	// Get user's organizations
	orgs, _, err := authenticatedClient.Organizations.ListOrgMemberships(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("error getting user organizations: %v", err)
	}

	for _, o := range orgs {
		log.Infof("Org: %v", o)
	}

	adminOrgs := make([]*github.Organization, 0)
	// for _, org := range orgs {
	// 	// Check membership status in the organization
	// 	membership, _, err := authenticatedClient.Organizations.GetOrgMembership(ctx, installation.AccountLogin, org.GetLogin())
	// 	if err != nil {
	// 		// Log the error but continue processing other orgs
	// 		log.Errorf("Error getting membership for org %s: %v\n", org.GetLogin(), err)
	// 		continue
	// 	}

	// 	// Check if user has admin role in this organization
	// 	if strings.EqualFold(membership.GetRole(), "admin") {
	// 		adminOrgs = append(adminOrgs, org)
	// 	}
	// }
	return adminOrgs, nil
}
