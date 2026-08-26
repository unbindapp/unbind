package builders

import (
	"context"
	"fmt"
	"os"
	"path"

	a "github.com/railwayapp/railpack/core/app"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/integrations/github"
	"github.com/unbindapp/unbind-api/pkg/builder/internal/buildkit"
)

// Builds a Dockerfile from a git repository
func (self *Builder) BuildDockerfile(ctx context.Context, buildSecrets map[string]string) (imageName, repoName string, err error) {
	repoName = self.RepoName()

	// -- Create github client
	ghClient := github.NewGithubClient(self.config.GithubURL, nil)

	// -- Clone repository
	log.Infof("Cloning ref '%s' from '%s'", self.config.GitRef, self.config.GitRepoURL)
	// Clone repository to infer information
	tmpDir, err := ghClient.CloneRepository(ctx,
		self.config.GithubAppID,
		self.config.GithubInstallationID,
		self.config.GithubAppPrivateKey,
		self.config.GitRepoURL,
		self.config.GitRef,
		self.config.CheckoutCommitSHA,
	)
	if err != nil {
		log.Error("Error cloning repository", "err", err)
		return "", repoName, err
	}
	defer os.RemoveAll(tmpDir)

	// Use default Dockerfile if not specified
	if self.config.ServiceDockerBuilderDockerfilePath == "" {
		self.config.ServiceDockerBuilderDockerfilePath = "Dockerfile"
	}

	// Check if Dockerfile exists
	fullDockerfilePath := path.Join(tmpDir, self.config.ServiceDockerBuilderDockerfilePath)
	if _, err := os.Stat(fullDockerfilePath); os.IsNotExist(err) {
		return "", repoName, fmt.Errorf("dockerfile not found at path: %s", self.config.ServiceDockerBuilderDockerfilePath)
	}

	// Make app from source
	app, err := a.NewApp(tmpDir)
	if err != nil {
		return "", repoName, fmt.Errorf("error creating app: %w", err)
	}

	// Metadata, resolved from the clone so the image ref covers the built commit.
	// Computed after the dockerfile path default above, so an unset path and an
	// explicit "Dockerfile" hash to the same build.
	inputs := self.buildInputs(tmpDir, buildSecrets)
	outputImage, cacheKey := self.GenerateBuildMetadata(inputs)

	// Build using BuildKit
	err = buildkit.BuildWithBuildkitClient(
		self.config,
		app.Source,
		buildkit.BuildWithBuildkitClientOptions{
			ImageName:      outputImage,
			CacheKey:       cacheKey,
			Secrets:        buildSecrets,
			DockerfilePath: self.config.ServiceDockerBuilderDockerfilePath,
			ContextPath:    self.config.ServiceDockerBuilderBuildContext,
		},
	)
	if err != nil {
		return "", repoName, fmt.Errorf("build failed: %v", err)
	}

	self.analyzeSource(tmpDir)

	log.Infof("Built image %s from Dockerfile: %s", outputImage, self.config.ServiceDockerBuilderDockerfilePath)
	return outputImage, repoName, nil
}
