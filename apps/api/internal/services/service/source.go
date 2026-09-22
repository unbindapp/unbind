package service_service

import (
	"context"
	"os"
	"strings"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

// githubSource is a repository the installation was verified to reach
type githubSource struct {
	installation  *ent.GithubInstallation
	ownerLogin    string
	repoName      string
	cloneURL      string
	defaultBranch string
}

func (self *ServiceService) verifyGithubRepository(ctx context.Context, installationID int64, owner, repo string) (*githubSource, error) {
	installation, err := self.repo.Github().GetInstallationByID(ctx, installationID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "GitHub installation not found")
		}
		return nil, err
	}

	canAccess, cloneURL, defaultBranch, ownerLogin, err := self.githubClient.VerifyRepositoryAccess(ctx, installation, owner, repo)
	if err != nil {
		log.Error("Error verifying repository access", "err", err)
		return nil, err
	}
	if canAccess {
		canAccess, err = self.githubClient.IsRepositoryInInstallation(ctx, installation, ownerLogin, repo)
		if err != nil {
			log.Error("Error verifying repository installation", "err", err)
			return nil, err
		}
	}
	if !canAccess {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Repository not accessible with the specified GitHub installation")
	}

	return &githubSource{
		installation:  installation,
		ownerLogin:    ownerLogin,
		repoName:      repo,
		cloneURL:      cloneURL,
		defaultBranch: defaultBranch,
	}, nil
}

func (self *ServiceService) verifyGithubBranch(ctx context.Context, source *githubSource, branch string) error {
	exists, err := self.githubClient.BranchExists(ctx, source.installation, source.ownerLogin, source.repoName, branch)
	if err != nil {
		log.Error("Error verifying branch", "err", err)
		return err
	}
	if !exists {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Branch \""+branch+"\" not found in "+source.ownerLogin+"/"+source.repoName)
	}
	return nil
}

// analyzeGithubSource clones a branch and detects what the code needs to run
func (self *ServiceService) analyzeGithubSource(ctx context.Context, source *githubSource, branch string, target sourceanalyzer.AnalysisTarget) (*sourceanalyzer.AnalysisResult, error) {
	installation := source.installation
	tmpDir, err := self.githubClient.CloneRepository(ctx, installation.GithubAppID, installation.ID, installation.Edges.GithubApp.PrivateKey, source.cloneURL, "refs/heads/"+branch, "")
	if err != nil {
		log.Error("Error cloning repository", "err", err)
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	result, err := sourceanalyzer.AnalyzeSourceCodeAnchored(tmpDir, target)
	if err != nil {
		log.Error("Error analyzing source code", "err", err)
		return nil, err
	}
	return result, nil
}

// detectedSource is what the analysis found, Unknown values clear the stored ones
type detectedSource struct {
	provider  enum.Provider
	framework enum.Framework
	icon      string
	ports     []schema.PortSpec
}

func summarizeAnalysis(serviceType schema.ServiceType, result *sourceanalyzer.AnalysisResult) detectedSource {
	detected := detectedSource{
		provider:  result.Provider,
		framework: result.Framework,
		icon:      string(serviceType),
		ports:     []schema.PortSpec{},
	}
	switch {
	case result.Framework != enum.UnknownFramework:
		detected.icon = string(result.Framework)
	case result.Provider != enum.UnknownProvider:
		detected.icon = string(result.Provider)
	}
	if result.Port != nil {
		detected.ports = append(detected.ports, schema.PortSpec{Port: int32(*result.Port)})
	}
	return detected
}

// validateSourceUpdate checks the source fields against the service type
func validateSourceUpdate(serviceType schema.ServiceType, input *models.UpdateServiceInput) error {
	repositoryFields := 0
	for _, set := range []bool{input.GitHubInstallationID != nil, input.RepositoryOwner != nil, input.RepositoryName != nil} {
		if set {
			repositoryFields++
		}
	}
	if repositoryFields != 0 && repositoryFields != 3 {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "GitHub installation, repository owner and repository name must be provided together")
	}
	if repositoryFields > 0 && (*input.RepositoryOwner == "" || *input.RepositoryName == "") {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Repository owner and name cannot be empty")
	}

	if serviceType != schema.ServiceTypeGithub {
		switch {
		case repositoryFields > 0:
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Only a git service can change its repository")
		case input.GitBranch != nil:
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Only a git service builds from a branch")
		case input.GitTag != nil:
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Only a git service builds from a tag")
		case input.WatchPaths != nil:
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Watch paths only apply to git services")
		}
	}

	if input.Image != nil && serviceType != schema.ServiceTypeDockerimage {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Only an image service can change its image")
	}
	if input.Image != nil && *input.Image == "" {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Image cannot be empty")
	}
	return nil
}

// prepareSourceChange verifies a new repository or branch and settles the branch to build from
func (self *ServiceService) prepareSourceChange(ctx context.Context, service *ent.Service, input *models.UpdateServiceInput) (*githubSource, error) {
	if input.RepositoryName != nil && sameRepository(service, input) {
		input.GitHubInstallationID = nil
		input.RepositoryOwner = nil
		input.RepositoryName = nil
	}

	if input.RepositoryName != nil {
		source, err := self.verifyGithubRepository(ctx, *input.GitHubInstallationID, *input.RepositoryOwner, *input.RepositoryName)
		if err != nil {
			return nil, err
		}
		input.RepositoryOwner = new(source.ownerLogin)
		if input.GitBranch == nil || *input.GitBranch == "" {
			input.GitBranch = new(source.defaultBranch)
		}
		if err := self.verifyGithubBranch(ctx, source, *input.GitBranch); err != nil {
			return nil, err
		}
		return source, nil
	}

	if input.GitBranch == nil || *input.GitBranch == "" {
		return nil, nil
	}
	current := service.Edges.ServiceConfig.GitBranch
	if current != nil && *current == *input.GitBranch {
		return nil, nil
	}
	if service.GithubInstallationID == nil || service.GitRepository == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Service has no repository to pick a branch from")
	}
	installation, err := self.repo.Github().GetInstallationByID(ctx, *service.GithubInstallationID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "GitHub installation not found")
		}
		return nil, err
	}
	source := &githubSource{installation: installation, ownerLogin: installation.AccountLogin, repoName: *service.GitRepository}
	return nil, self.verifyGithubBranch(ctx, source, *input.GitBranch)
}

func sameRepository(service *ent.Service, input *models.UpdateServiceInput) bool {
	if service.GithubInstallationID == nil || service.GitRepository == nil || service.GitRepositoryOwner == nil {
		return false
	}
	return *service.GithubInstallationID == *input.GitHubInstallationID &&
		strings.EqualFold(*service.GitRepositoryOwner, *input.RepositoryOwner) &&
		strings.EqualFold(*service.GitRepository, *input.RepositoryName)
}

// analysisTarget uses the incoming build settings, falling back to the stored ones
func analysisTarget(config *ent.ServiceConfig, input *models.UpdateServiceInput) sourceanalyzer.AnalysisTarget {
	pick := func(incoming, stored *string) string {
		if incoming != nil {
			return *incoming
		}
		if stored != nil {
			return *stored
		}
		return ""
	}
	return sourceanalyzer.AnalysisTarget{
		DockerfilePath: pick(input.DockerBuilderDockerfilePath, config.DockerBuilderDockerfilePath),
		BuildContext:   pick(input.DockerBuilderBuildContext, config.DockerBuilderBuildContext),
		RunCommand:     pick(input.RunCommand, config.RunCommand),
	}
}
