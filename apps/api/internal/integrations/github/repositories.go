package github

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"golang.org/x/sync/errgroup"
)

// ! If needed a paginated approach is in commit ef4adf6ed6a0411897006586454de97c1d6e8a7f
// For now we roll without it

// Read user's admin repositories (that they can configure CI/CD on)
func (self *GithubClient) ReadUserAdminRepositories(ctx context.Context, installations []*ent.GithubInstallation) ([]*GithubRepository, error) {
	var mu sync.Mutex
	allAdminRepos := make([]*GithubRepository, 0)

	// limit concurrency
	const maxConcurrency = 3
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(maxConcurrency)

	// Process installations concurrently with a limit
	for _, installation := range installations {
		if installation == nil || installation.Edges.GithubApp == nil {
			log.Warnf("Invalid installation to read repositories from, missing appedge or nil: %v", installation)
			continue
		}

		// Copy the installation variable to avoid closure issues
		inst := installation

		g.Go(func() error {
			authenticatedClient, err := self.GetAuthenticatedClient(gctx, inst.GithubAppID, inst.ID, inst.Edges.GithubApp.PrivateKey)
			if err != nil {
				return fmt.Errorf("error getting authenticated client for %s: %v", inst.AccountLogin, err)
			}
			defer authenticatedClient.Client().CloseIdleConnections()

			// Process repositories with proper pagination
			var adminRepos []*github.Repository

			if inst.AccountType == githubinstallation.AccountTypeOrganization {
				repos, e := self.fetchOrganizationAdminRepos(gctx, authenticatedClient, inst)
				adminRepos = repos
				err = e
			} else {
				repos, e := self.fetchUserAdminRepos(gctx, authenticatedClient, inst)
				adminRepos = repos
				err = e
			}

			if err != nil {
				return err
			}

			// Format and add to the result slice in a thread-safe way
			formattedRepos := formatRepositoryResponse(adminRepos, inst.ID)
			mu.Lock()
			allAdminRepos = append(allAdminRepos, formattedRepos...)
			mu.Unlock()

			return nil
		})
	}

	// Wait for all goroutines to complete
	if err := g.Wait(); err != nil {
		return nil, err
	}

	// Sort
	sortRepositories(allAdminRepos)

	// Remove any duplicates
	return removeDuplicateRepositories(allAdminRepos), nil
}

// fetchUserAdminRepos fetches all admin repositories for a user with proper pagination and memory limits
func (self *GithubClient) fetchUserAdminRepos(ctx context.Context, client *github.Client, inst *ent.GithubInstallation) ([]*github.Repository, error) {
	adminRepos := make([]*github.Repository, 0)
	opts := &github.RepositoryListByUserOptions{
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
		Sort: "updated",
	}

	for {
		// Check if context is canceled
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Get user's repositories with pagination
		ghRepositories, resp, err := client.Repositories.ListByUser(ctx, inst.AccountLogin, opts)
		if err != nil {
			return nil, fmt.Errorf("error getting repositories for user %s: %v", inst.AccountLogin, err)
		}

		// Filter admin repositories
		for _, repo := range ghRepositories {
			isAdmin := false

			if inst.AccountType == githubinstallation.AccountTypeUser {
				if repo.GetOwner().GetID() == inst.AccountID {
					isAdmin = true
				}
			}

			// Check permissions
			if !isAdmin {
				if perms := repo.GetPermissions(); perms != nil {
					if admin, ok := perms["admin"]; ok && admin {
						isAdmin = true
					}
				}
			}

			if isAdmin {
				adminRepos = append(adminRepos, repo)
			}
		}

		// Check if there are more pages
		if resp.NextPage == 0 {
			break
		}

		// Set up for next page
		opts.Page = resp.NextPage
	}

	return adminRepos, nil
}

func (self *GithubClient) fetchOrganizationAdminRepos(ctx context.Context, client *github.Client, inst *ent.GithubInstallation) ([]*github.Repository, error) {
	adminRepos := make([]*github.Repository, 0)
	opts := &github.RepositoryListByOrgOptions{
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
		Sort: "updated",
	}

	for {
		// Check if context is canceled
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Get user's repositories with pagination
		ghRepositories, resp, err := client.Repositories.ListByOrg(ctx, inst.AccountLogin, opts)
		if err != nil {
			return nil, fmt.Errorf("error getting repositories for user %s: %v", inst.AccountLogin, err)
		}

		// Filter admin repositories
		for _, repo := range ghRepositories {
			// TODO: Check if the user is an admin
			isAdmin := true
			if isAdmin {
				adminRepos = append(adminRepos, repo)
			}
		}

		// Check if there are more pages
		if resp.NextPage == 0 {
			break
		}

		// Set up for next page
		opts.Page = resp.NextPage
	}

	return adminRepos, nil
}

// Sort repositories sorts by updated field
func sortRepositories(repos []*GithubRepository) {
	sort.Slice(repos, func(i, j int) bool {
		return repos[i].UpdatedAt.After(repos[j].UpdatedAt)
	})
}

// removeDuplicateRepositories removes duplicate repositories from the slice
func removeDuplicateRepositories(repos []*GithubRepository) []*GithubRepository {
	seen := make(map[int64]bool)
	result := make([]*GithubRepository, 0, len(repos))

	for _, repo := range repos {
		if !seen[repo.ID] {
			seen[repo.ID] = true
			result = append(result, repo)
		}
	}

	return result
}

// * Formatting
type GithubRepositoryOwner struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

type GithubRepository struct {
	ID             int64                 `json:"id"`
	InstallationID int64                 `json:"installation_id"`
	Name           string                `json:"name"`
	FullName       string                `json:"full_name"`
	HTMLURL        string                `json:"html_url"`
	CloneURL       string                `json:"clone_url"`
	HomePage       string                `json:"homepage"`
	Owner          GithubRepositoryOwner `json:"owner"`
	UpdatedAt      time.Time             `json:"updated_at"`
}

func formatRepositoryResponse(repositories []*github.Repository, installationID int64) []*GithubRepository {
	// Pre-allocate the slice to the exact size needed to avoid reallocations
	response := make([]*GithubRepository, 0, len(repositories))

	for _, repository := range repositories {
		// Skip repositories with nil owners to prevent panic
		if repository.Owner == nil {
			log.Warnf("Skipping repository with nil owner: %s", repository.GetName())
			continue
		}

		response = append(response, &GithubRepository{
			ID:             repository.GetID(),
			InstallationID: installationID,
			Name:           repository.GetName(),
			FullName:       repository.GetFullName(),
			HTMLURL:        repository.GetHTMLURL(),
			CloneURL:       repository.GetCloneURL(),
			HomePage:       repository.GetHomepage(),
			Owner: GithubRepositoryOwner{
				ID:        repository.Owner.GetID(),
				Name:      repository.Owner.GetName(),
				Login:     repository.Owner.GetLogin(),
				AvatarURL: repository.Owner.GetAvatarURL(),
			},
			UpdatedAt: repository.GetUpdatedAt().Time,
		})
	}
	return response
}

// ! Getting repository details
// GithubRepositoryDetail contains detailed information about a repository
type GithubRepositoryDetail struct {
	ID              int64                  `json:"id"`
	InstallationID  int64                  `json:"installationId"`
	Name            string                 `json:"name"`
	FullName        string                 `json:"fullName"`
	Description     string                 `json:"description"`
	URL             string                 `json:"url"`
	HTMLURL         string                 `json:"htmlUrl"`
	DefaultBranch   string                 `json:"defaultBranch"`
	Language        string                 `json:"language"`
	Private         bool                   `json:"private"`
	Fork            bool                   `json:"fork"`
	Archived        bool                   `json:"archived"`
	Disabled        bool                   `json:"disabled"`
	Size            int                    `json:"size"`
	StargazersCount int                    `json:"stargazersCount"`
	WatchersCount   int                    `json:"watchersCount"`
	ForksCount      int                    `json:"forksCount"`
	OpenIssuesCount int                    `json:"openIssuesCount"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
	PushedAt        time.Time              `json:"pushedAt"`
	Branches        []*GithubBranch        `json:"branches"`
	Tags            []*GithubTag           `json:"tags"`
	Owner           *GithubRepositoryOwner `json:"owner"`
}

// GithubBranch contains information about a branch
type GithubBranch struct {
	Name      string `json:"name"`
	Ref       string `json:"ref"`
	Protected bool   `json:"protected"`
	SHA       string `json:"sha"`
}

// GithubTag contains information about a tag
type GithubTag struct {
	Name string `json:"name"`
	Ref  string `json:"ref"`
	SHA  string `json:"sha"`
}

// Get details for a repository
func (self *GithubClient) GetRepositoryDetail(ctx context.Context, installation *ent.GithubInstallation, owner, repo string) (*GithubRepositoryDetail, error) {
	if installation == nil || installation.Edges.GithubApp == nil {
		return nil, fmt.Errorf("invalid installation: missing app edge or nil")
	}

	// We'll use a client with a timeout context to ensure we don't hang indefinitely
	timeoutCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	// Get authenticated client
	authenticatedClient, err := self.GetAuthenticatedClient(timeoutCtx, installation.GithubAppID, installation.ID, installation.Edges.GithubApp.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("error getting authenticated client for %s: %v", installation.AccountLogin, err)
	}
	defer authenticatedClient.Client().CloseIdleConnections()

	// Get repository information
	ghRepo, _, err := authenticatedClient.Repositories.Get(ctx, owner, repo)
	if err != nil {
		return nil, fmt.Errorf("error getting repository %s/%s: %v", owner, repo, err)
	}

	var branches []*GithubBranch
	var tags []*GithubTag
	var wg sync.WaitGroup
	var branchErr, tagErr error

	wg.Add(2)
	go func() {
		defer wg.Done()
		branches, branchErr = self.getRepositoryBranches(timeoutCtx, authenticatedClient, owner, repo)
		if branchErr != nil {
			log.Warn("Error getting repository branches", "err", branchErr, "owner", owner, "repo", repo)
			branchErr = nil // Don't fail the entire request for this
		}
	}()

	go func() {
		defer wg.Done()
		tags, tagErr = self.getRepositoryTags(timeoutCtx, authenticatedClient, owner, repo)
		if tagErr != nil {
			log.Warn("Error getting repository tags", "err", tagErr, "owner", owner, "repo", repo)
			tagErr = nil // Don't fail the entire request for this
		}
	}()

	wg.Wait()

	// Format the response
	repoDetail := &GithubRepositoryDetail{
		ID:              ghRepo.GetID(),
		InstallationID:  installation.ID,
		Name:            ghRepo.GetName(),
		FullName:        ghRepo.GetFullName(),
		Description:     ghRepo.GetDescription(),
		URL:             ghRepo.GetURL(),
		HTMLURL:         ghRepo.GetHTMLURL(),
		DefaultBranch:   ghRepo.GetDefaultBranch(),
		Language:        ghRepo.GetLanguage(),
		Private:         ghRepo.GetPrivate(),
		Fork:            ghRepo.GetFork(),
		Archived:        ghRepo.GetArchived(),
		Disabled:        ghRepo.GetDisabled(),
		Size:            ghRepo.GetSize(),
		StargazersCount: ghRepo.GetStargazersCount(),
		WatchersCount:   ghRepo.GetWatchersCount(),
		ForksCount:      ghRepo.GetForksCount(),
		OpenIssuesCount: ghRepo.GetOpenIssuesCount(),
		CreatedAt:       ghRepo.GetCreatedAt().Time,
		UpdatedAt:       ghRepo.GetUpdatedAt().Time,
		PushedAt:        ghRepo.GetPushedAt().Time,
		Branches:        branches,
		Tags:            tags,
	}

	// Add owner information if available
	if ghRepo.Owner != nil {
		repoDetail.Owner = &GithubRepositoryOwner{
			ID:        ghRepo.Owner.GetID(),
			Name:      ghRepo.Owner.GetName(),
			Login:     ghRepo.Owner.GetLogin(),
			AvatarURL: ghRepo.Owner.GetAvatarURL(),
		}
	}

	return repoDetail, nil
}

// Get branches for a repository - improved with context handling
func (self *GithubClient) getRepositoryBranches(ctx context.Context, client *github.Client, owner, repo string) ([]*GithubBranch, error) {
	opts := &github.BranchListOptions{
		ListOptions: github.ListOptions{
			PerPage: 50,
		},
	}

	var allBranches []*GithubBranch
	for {
		// Check if context is canceled
		select {
		case <-ctx.Done():
			return allBranches, ctx.Err()
		default:
		}

		branches, resp, err := client.Repositories.ListBranches(ctx, owner, repo, opts)
		if err != nil {
			return allBranches, fmt.Errorf("error listing branches: %v", err)
		}
		allBranches = make([]*GithubBranch, len(branches))

		for i, branch := range branches {
			allBranches[i] = &GithubBranch{
				Name:      branch.GetName(),
				Protected: branch.GetProtected(),
				SHA:       branch.GetCommit().GetSHA(),
				Ref:       fmt.Sprintf("refs/heads/%s", branch.GetName()),
			}
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return allBranches, nil
}

// getRepositoryTags retrieves a list of tags for a repository - improved with context handling
func (self *GithubClient) getRepositoryTags(ctx context.Context, client *github.Client, owner, repo string) ([]*GithubTag, error) {
	opts := &github.ListOptions{
		PerPage: 100,
	}

	var allTags []*GithubTag
	for {
		// Check if context is canceled
		select {
		case <-ctx.Done():
			return allTags, ctx.Err()
		default:
		}

		tags, resp, err := client.Repositories.ListTags(ctx, owner, repo, opts)
		if err != nil {
			return allTags, fmt.Errorf("error listing tags: %v", err)
		}
		allTags = make([]*GithubTag, len(tags))

		for i, tag := range tags {
			allTags[i] = &GithubTag{
				Name: tag.GetName(),
				Ref:  fmt.Sprintf("refs/tags/%s", tag.GetName()),
				SHA:  tag.GetCommit().GetSHA(),
			}
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return allTags, nil
}

// VerifyRepositoryAccess with resource cleanup
func (self *GithubClient) VerifyRepositoryAccess(ctx context.Context, installation *ent.GithubInstallation, owner, repo string) (canAccess bool, repoUrl, defaultBranch string, err error) {
	if installation == nil || installation.Edges.GithubApp == nil {
		return false, "", "", fmt.Errorf("invalid installation: missing app edge or nil")
	}

	// Use a short timeout for this simple verification
	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	// Get authenticated client
	authenticatedClient, err := self.GetAuthenticatedClient(timeoutCtx, installation.GithubAppID, installation.ID, installation.Edges.GithubApp.PrivateKey)
	if err != nil {
		return false, "", "", fmt.Errorf("error getting authenticated client for %s: %v", installation.AccountLogin, err)
	}
	defer authenticatedClient.Client().CloseIdleConnections()

	// See if we can access the repository
	repoResult, resp, err := authenticatedClient.Repositories.Get(ctx, owner, repo)
	if err == nil {
		// Repository found and accessible
		return true, repoResult.GetCloneURL(), repoResult.GetDefaultBranch(), nil
	}

	if resp != nil && resp.StatusCode == 404 {
		// Repository either doesn't exist or installation doesn't have access
		return false, "", "", nil
	}

	log.Errorf("Error verifying repository access: %v", err)
	return false, "", "", nil
}

// Get branch head summary - sha, message, author
// GetCommitSummary - get summary for a specific commit or branch head
func (self *GithubClient) GetCommitSummary(ctx context.Context, installation *ent.GithubInstallation, owner, repo string, branchOrSHA string, isCommitSHA bool) (commitSHA, commitMessage string, committer *schema.GitCommitter, err error) {
	if installation == nil || installation.Edges.GithubApp == nil {
		return "", "", nil, fmt.Errorf("invalid installation: missing app edge or nil")
	}

	// Use a timeout context to ensure we don't hang indefinitely
	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	// Get authenticated client
	authenticatedClient, err := self.GetAuthenticatedClient(timeoutCtx, installation.GithubAppID, installation.ID, installation.Edges.GithubApp.PrivateKey)
	if err != nil {
		return "", "", nil, fmt.Errorf("error getting authenticated client for %s: %v", installation.AccountLogin, err)
	}
	defer authenticatedClient.Client().CloseIdleConnections()

	var repoCommit *github.RepositoryCommit

	if isCommitSHA {
		commitSHA = branchOrSHA
		// Get commit by SHA
		repoCommit, _, err = authenticatedClient.Repositories.GetCommit(ctx, owner, repo, branchOrSHA, nil)
		if err != nil {
			return "", "", nil, fmt.Errorf("error getting commit %s for repository %s/%s: %v", branchOrSHA, owner, repo, err)
		}
	} else {
		// Get branch information (which includes the head commit SHA)
		branchInfo, _, err := authenticatedClient.Repositories.GetBranch(ctx, owner, repo, branchOrSHA, 3)
		if err != nil {
			return "", "", nil, fmt.Errorf("error getting branch %s for repository %s/%s: %v", branchOrSHA, owner, repo, err)
		}
		// Get the commit SHA from the branch
		commitSHA = branchInfo.GetCommit().GetSHA()
		// Use the commit SHA to get the full commit information
		repoCommit, _, err = authenticatedClient.Repositories.GetCommit(ctx, owner, repo, commitSHA, nil)
		if err != nil {
			return "", "", nil, fmt.Errorf("error getting commit %s for repository %s/%s: %v", commitSHA, owner, repo, err)
		}
	}

	commit := repoCommit.GetCommit()
	author := repoCommit.GetAuthor()

	commitMessage = commit.GetMessage()

	if author != nil {
		committer = &schema.GitCommitter{
			Name:      author.GetLogin(),
			AvatarURL: author.GetAvatarURL(),
		}
	}

	return commitSHA, commitMessage, committer, nil
}
