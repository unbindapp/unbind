package github

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// ClonePublicRepository clones a public repository without authentication
func (self *GithubClient) ClonePublicRepository(ctx context.Context, repoURL string, refName string, commitSHA string) (string, error) {
	return clone(ctx, nil, repoURL, refName, commitSHA)
}

// CloneRepository clones a repository with optional authentication
func (self *GithubClient) CloneRepository(ctx context.Context, appID, installationID int64, appPrivateKey string, repoURL string, refName string, commitSHA string) (string, error) {
	// If no authentication is provided, use public clone
	if appID == 0 || installationID == 0 || appPrivateKey == "" {
		return self.ClonePublicRepository(ctx, repoURL, refName, commitSHA)
	}

	bearerToken, err := self.GetInstallationToken(ctx, appID, installationID, appPrivateKey)
	if err != nil {
		return "", err
	}

	return clone(ctx, &http.BasicAuth{
		Username: "x-access-token",
		Password: bearerToken,
	}, repoURL, refName, commitSHA)
}

func clone(ctx context.Context, auth transport.AuthMethod, repoURL string, refName string, commitSHA string) (string, error) {
	tmpDir, err := os.MkdirTemp("", "unbind-api-clone")
	if err != nil {
		return "", err
	}

	if commitSHA != "" {
		err = fetchCommit(ctx, tmpDir, auth, repoURL, refName, commitSHA)
	} else {
		err = cloneRef(ctx, tmpDir, auth, repoURL, refName)
	}
	if err != nil {
		os.RemoveAll(tmpDir)
		return "", err
	}

	return tmpDir, nil
}

// fetchCommit downloads only the given commit and stores it under refName, so tools
// reading the branch or tag name in the build still find it
func fetchCommit(ctx context.Context, dir string, auth transport.AuthMethod, repoURL string, refName string, commitSHA string) error {
	repo, err := git.PlainInit(dir, false)
	if err != nil {
		return fmt.Errorf("failed to init repository: %v", err)
	}

	if _, err := repo.CreateRemote(&config.RemoteConfig{
		Name: git.DefaultRemoteName,
		URLs: []string{repoURL},
	}); err != nil {
		return fmt.Errorf("failed to add remote: %v", err)
	}

	err = repo.FetchContext(ctx, &git.FetchOptions{
		RemoteName: git.DefaultRemoteName,
		Auth:       auth,
		RefSpecs:   []config.RefSpec{config.RefSpec(commitSHA + ":" + refName)},
		Depth:      1,
		Progress:   &loggerOutput{logger: log.GetLogger()},
	})
	if err != nil {
		return fmt.Errorf("failed to fetch commit %s: %v", commitSHA, err)
	}

	worktree, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("failed to get worktree: %v", err)
	}

	checkout := &git.CheckoutOptions{Hash: plumbing.NewHash(commitSHA)}
	if ref := plumbing.ReferenceName(refName); ref.IsBranch() {
		checkout = &git.CheckoutOptions{Branch: ref}
	}
	if err := worktree.Checkout(checkout); err != nil {
		return fmt.Errorf("failed to checkout commit %s: %v", commitSHA, err)
	}

	return nil
}

func cloneRef(ctx context.Context, dir string, auth transport.AuthMethod, repoURL string, refName string) error {
	cloneOptions := &git.CloneOptions{
		URL:           repoURL,
		Auth:          auth,
		Progress:      &loggerOutput{logger: log.GetLogger()},
		ReferenceName: plumbing.ReferenceName(refName),
		Depth:         1,
		SingleBranch:  true,
	}

	isTag := strings.HasPrefix(refName, "refs/tags/")
	if isTag {
		cloneOptions.Depth = 0
		cloneOptions.SingleBranch = false
	}

	repo, err := git.PlainCloneContext(ctx, dir, false, cloneOptions)
	if err != nil {
		return fmt.Errorf("failed to clone repository: %v", err)
	}

	if !isTag {
		return nil
	}

	worktree, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("failed to get worktree: %v", err)
	}

	tagName := strings.TrimPrefix(refName, "refs/tags/")
	tag, err := repo.Tag(tagName)
	if err != nil {
		return fmt.Errorf("failed to get tag %s: %v", tagName, err)
	}

	if err := worktree.Checkout(&git.CheckoutOptions{Hash: tag.Hash()}); err != nil {
		return fmt.Errorf("failed to checkout tag %s: %v", tagName, err)
	}

	return nil
}

type loggerOutput struct {
	logger *log.Logger
}

func (l *loggerOutput) Write(p []byte) (n int, err error) {
	l.logger.Infof("%s", p)
	return len(p), nil
}
