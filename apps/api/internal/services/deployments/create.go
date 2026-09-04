package deployments_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *DeploymentService) CreateManualDeployment(ctx context.Context, requesterUserId uuid.UUID, input *models.CreateDeploymentInput) (*models.DeploymentResponse, error) {
	// Editor can create deployments
	if err := self.repo.Permissions().Check(ctx, requesterUserId, []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.ServiceID,
		},
	}); err != nil {
		return nil, err
	}

	service, err := self.validateInputs(ctx, input)
	if err != nil {
		return nil, err
	}

	// Check if we can deploy the current image without rebuilding, disabling the build cache implies a rebuild
	if input.SmartRedeploy && !input.DisableBuildCache {
		currentDeployment := service.Edges.CurrentDeployment
		matchesRequestedSha := input.GitSha == nil ||
			(currentDeployment != nil && currentDeployment.CommitSha != nil && *currentDeployment.CommitSha == *input.GitSha)
		if matchesRequestedSha && !configuredImageChanged(service, currentDeployment) && self.canRedeployWithoutBuild(ctx, service, currentDeployment) {
			return self.redeployExistingImage(ctx, service, currentDeployment)
		}
	}

	// Get git information if applicable
	var commitSHA string
	var commitMessage string
	var committer *schema.GitCommitter
	var gitBranch string

	if service.GithubInstallationID != nil && service.GitRepository != nil && service.Edges.ServiceConfig.GitBranch != nil {
		installation, err := self.repo.Github().GetInstallationByID(ctx, *service.GithubInstallationID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Invalid github installation")
			}
			log.Error("Error getting github installation", "err", err)
			return nil, err
		}

		gitBranch = *service.Edges.ServiceConfig.GitBranch
		summaryTarget := gitBranch
		isCommitHash := false
		if input.GitSha != nil {
			summaryTarget = *input.GitSha
			isCommitHash = true
		}

		commitSHA, commitMessage, committer, err = self.githubClient.GetCommitSummary(ctx,
			installation,
			installation.AccountLogin,
			*service.GitRepository,
			summaryTarget,
			isCommitHash)

		// ! TODO - Should we hard fail here?
		if err != nil {
			return nil, err
		}
	}
	env, err := self.deploymentController.PopulateBuildEnvironment(ctx, input.ServiceID, nil, nil)
	if err != nil {
		return nil, err
	}
	if input.GitSha != nil {
		env["CHECKOUT_COMMIT_SHA"] = *input.GitSha
	}

	job, err := self.deploymentController.EnqueueDeploymentJob(ctx, deployctl.DeploymentJobRequest{
		ServiceID:         input.ServiceID,
		Environment:       env,
		Source:            schema.DeploymentSourceManual,
		CommitSHA:         commitSHA,
		GitBranch:         gitBranch,
		CommitMessage:     commitMessage,
		Committer:         committer,
		DisableBuildCache: input.DisableBuildCache,
	})
	if err != nil {
		return nil, err
	}

	return models.TransformDeploymentEntity(job), nil
}

// configuredImageChanged reports whether an image service points at a different image
// than the one it is running, in which case the old image can't simply be redeployed
func configuredImageChanged(service *ent.Service, deployment *ent.Deployment) bool {
	if service.Type != schema.ServiceTypeDockerimage || deployment == nil || deployment.Image == nil {
		return false
	}
	return service.Edges.ServiceConfig.Image != "" && service.Edges.ServiceConfig.Image != *deployment.Image
}
