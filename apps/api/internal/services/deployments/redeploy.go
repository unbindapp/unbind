package deployments_service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	ubv1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
)

func (self *DeploymentService) resolveReferences(ctx context.Context, service *ent.Service) ([]corev1.EnvVar, error) {
	// Resolve references
	additionalEnv, err := self.variableService.ResolveAllReferences(ctx, service.ID)
	if err != nil {
		return nil, err
	}
	envVars := make([]corev1.EnvVar, len(additionalEnv))
	i := 0
	for k, v := range additionalEnv {
		envVars[i] = corev1.EnvVar{
			Name:  k,
			Value: v,
		}
		i++
	}

	return envVars, nil
}

func (self *DeploymentService) redeployExistingImage(ctx context.Context, service *ent.Service, deployment *ent.Deployment) (*models.DeploymentResponse, error) {
	// Update env
	envVars, err := self.resolveReferences(ctx, service)
	if err != nil {
		return nil, err
	}

	// Copy deployment
	newDeployment, err := self.repo.Deployment().CreateCopy(ctx, nil, deployment)
	if err != nil {
		return nil, err
	}

	// Create a CRD from the service configuration
	newDeployment.ResourceDefinition = self.CreateCRDFromService(service)

	// Update deployment resource definition
	newDeployment.ResourceDefinition.Spec.DeploymentRef = newDeployment.ID.String()
	newDeployment.ResourceDefinition.Spec.EnvVars = envVars
	newDeployment.ResourceDefinition.Spec.Config.Volumes = schema.AsV1Volumes(service.Edges.ServiceConfig.Volumes)

	// For docker image services, update the image reference
	if service.Type == schema.ServiceTypeDockerimage {
		if deployment.Image == nil {
			newDeployment.ResourceDefinition.Spec.Config.Image = service.Edges.ServiceConfig.Image
			newDeployment.Image = utils.ToPtr(service.Edges.ServiceConfig.Image)
		} else {
			newDeployment.ResourceDefinition.Spec.Config.Image = *deployment.Image
			newDeployment.Image = utils.ToPtr(*deployment.Image)
		}
	}

	// For database services, always use latest config
	if service.Type == schema.ServiceTypeDatabase && service.Edges.ServiceConfig.DatabaseConfig != nil {
		newDeployment.ResourceDefinition.Spec.Config.Database.Config = service.Edges.ServiceConfig.DatabaseConfig.AsV1DatabaseConfig()
	}

	// Deploy to kubernetes
	_, _, err = self.k8s.DeployUnbindService(ctx, newDeployment.ResourceDefinition)
	if err != nil {
		// Mark failed
		if _, err := self.repo.Deployment().MarkFailed(ctx, nil, newDeployment.ID, err.Error(), time.Now()); err != nil {
			return nil, err
		}
		return nil, err
	}

	// Attach metadata
	if _, err := self.repo.Deployment().AttachDeploymentMetadata(
		ctx,
		nil,
		newDeployment.ID,
		newDeployment.ResourceDefinition.Spec.Config.Image,
		newDeployment.ResourceDefinition,
	); err != nil {
		// Mark failed
		if _, err := self.repo.Deployment().MarkFailed(ctx, nil, newDeployment.ID, err.Error(), time.Now()); err != nil {
			return nil, err
		}
		// Pass through since we already marked the deployment as failed
		return nil, err
	}

	// Mark as succeeded
	newDeployment, err = self.repo.Deployment().MarkSucceeded(ctx, nil, newDeployment.ID, time.Now())
	if err != nil {
		return nil, err
	}

	// Update the service with the new deployment
	if err := self.repo.Service().SetCurrentDeployment(ctx, nil, service.ID, newDeployment.ID); err != nil {
		return nil, err
	}

	return models.TransformDeploymentEntity(newDeployment), nil
}

func (self *DeploymentService) CreateRedeployment(ctx context.Context, requesterUserId uuid.UUID, input *models.RedeployExistingDeploymentInput) (*models.DeploymentResponse, error) {
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

	// Get existing deployment
	deployment, err := self.repo.Deployment().GetByID(ctx, input.DeploymentID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Deployment not found")
		}
		return nil, err
	}

	// Check if we can redeploy without rebuilding
	if input.SmartRedeploy && deployment.ResourceDefinition != nil {
		canRedeploy := false

		// For non-database services, check if we can pull the existing image
		if service.Type != schema.ServiceTypeDatabase && deployment.Image != nil {
			canPullImage, _ := self.registryTester.CanPullImage(ctx, *deployment.Image)
			canRedeploy = canPullImage
		}

		// For database and docker image services, we can always redeploy
		if service.Type == schema.ServiceTypeDatabase || service.Type == schema.ServiceTypeDockerimage {
			canRedeploy = true
		}

		if canRedeploy {
			return self.redeployExistingImage(ctx, service, deployment)
		}
	}

	// Build a full deployment
	// Get git information if applicable
	var commitMessage string
	var commitSha string
	var gitBranch string

	if deployment.CommitMessage != nil {
		commitMessage = *deployment.CommitMessage
	}

	if deployment.GitBranch != nil {
		gitBranch = *deployment.GitBranch
	}

	// Enqueue build job
	env, err := self.deploymentController.PopulateBuildEnvironment(ctx, input.ServiceID, nil, deployment)
	if err != nil {
		return nil, err
	}

	if deployment.CommitSha != nil {
		commitSha = *deployment.CommitSha
		env["CHECKOUT_COMMIT_SHA"] = commitSha
	}

	job, err := self.deploymentController.EnqueueDeploymentJob(ctx, deployctl.DeploymentJobRequest{
		ServiceID:         input.ServiceID,
		Environment:       env,
		Source:            schema.DeploymentSourceManual,
		CommitSHA:         commitSha,
		CommitMessage:     commitMessage,
		GitBranch:         gitBranch,
		Committer:         deployment.CommitAuthor,
		DisableBuildCache: input.DisableBuildCache,
	})
	if err != nil {
		return nil, err
	}

	return models.TransformDeploymentEntity(job), nil
}

// CreateCRDFromService creates a CRD from the service configuration
func (self *DeploymentService) CreateCRDFromService(service *ent.Service) *ubv1.Service {
	crdToDeploy := &ubv1.Service{}

	// For databsae fetch the crd from the current deployment
	if service.Type == schema.ServiceTypeDatabase && service.Edges.CurrentDeployment != nil && service.Edges.CurrentDeployment.ResourceDefinition != nil {
		crdToDeploy = service.Edges.CurrentDeployment.ResourceDefinition
		if service.Edges.ServiceConfig.DatabaseConfig != nil {
			crdToDeploy.Spec.Config.Database.Config = service.Edges.ServiceConfig.DatabaseConfig.AsV1DatabaseConfig()
		}
	}

	// Metadata
	crdToDeploy.Name = service.Edges.CurrentDeployment.ResourceDefinition.Name
	crdToDeploy.Namespace = service.Edges.CurrentDeployment.ResourceDefinition.Namespace
	crdToDeploy.Kind = service.Edges.CurrentDeployment.ResourceDefinition.Kind
	crdToDeploy.APIVersion = service.Edges.CurrentDeployment.ResourceDefinition.APIVersion
	crdToDeploy.Labels = service.Edges.CurrentDeployment.ResourceDefinition.Labels
	crdToDeploy.Spec = service.Edges.CurrentDeployment.ResourceDefinition.Spec

	// Update the Spec
	var gitBranch string

	// Preserve git branch from service config
	if service.Edges.ServiceConfig.GitBranch != nil {
		gitBranch = *service.Edges.ServiceConfig.GitBranch
		if !strings.HasPrefix(gitBranch, "refs/heads/") {
			gitBranch = fmt.Sprintf("refs/heads/%s", gitBranch)
		}
	}

	crdToDeploy.Spec.Config.GitBranch = gitBranch
	crdToDeploy.Spec.Config.Hosts = schema.AsV1HostSpecs(service.Edges.ServiceConfig.Hosts)
	crdToDeploy.Spec.Config.Replicas = utils.ToPtr(service.Edges.ServiceConfig.Replicas)
	crdToDeploy.Spec.Config.Ports = schema.AsV1PortSpecs(service.Edges.ServiceConfig.Ports)
	crdToDeploy.Spec.Config.RunCommand = service.Edges.ServiceConfig.RunCommand
	crdToDeploy.Spec.Config.Public = service.Edges.ServiceConfig.IsPublic
	crdToDeploy.Spec.Config.Volumes = schema.AsV1Volumes(service.Edges.ServiceConfig.Volumes)

	// ! Prune hosts without a valid port
	var prunedHosts []ubv1.HostSpec
	for _, host := range crdToDeploy.Spec.Config.Hosts {
		if host.Port != nil {
			prunedHosts = append(prunedHosts, host)
		}
	}
	crdToDeploy.Spec.Config.Hosts = prunedHosts

	return crdToDeploy
}
