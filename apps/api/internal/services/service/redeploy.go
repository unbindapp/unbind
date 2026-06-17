package service_service

import (
	"context"
	"fmt"
	"time"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	corev1 "k8s.io/api/core/v1"
)

// EnqueueFullBuildDeployments enqueues full deployment jobs for services that need a complete rebuild
func (self *ServiceService) EnqueueFullBuildDeployments(ctx context.Context, services []*ent.Service) error {
	for _, service := range services {
		// Populate build environment
		env, err := self.deploymentController.PopulateBuildEnvironment(ctx, service.ID, nil, nil)
		if err != nil {
			return fmt.Errorf("failed to populate build environment for service %s: %w", service.ID, err)
		}

		var commitSHA string
		var commitMessage string
		var committer *schema.GitCommitter
		var gitBranch string

		// Get git information if available
		if service.GithubInstallationID != nil && service.GitRepository != nil && service.Edges.ServiceConfig.GitBranch != nil {
			// Get installation
			installation, err := self.repo.Github().GetInstallationByID(ctx, *service.GithubInstallationID)
			if err != nil {
				if ent.IsNotFound(err) {
					return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Invalid github installation")
				}
				log.Error("Error getting github installation", "err", err)
				return err
			}

			gitBranch = *service.Edges.ServiceConfig.GitBranch
			commitSHA, commitMessage, committer, err = self.githubClient.GetCommitSummary(ctx,
				installation,
				installation.AccountLogin,
				*service.GitRepository,
				gitBranch,
				false)

			if err != nil {
				return fmt.Errorf("failed to get branch head summary for service %s: %w", service.ID, err)
			}
		}

		// Enqueue deployment job
		_, err = self.deploymentController.EnqueueDeploymentJob(ctx, deployctl.DeploymentJobRequest{
			ServiceID:     service.ID,
			Environment:   env,
			Source:        schema.DeploymentSourceManual,
			CommitSHA:     commitSHA,
			CommitMessage: commitMessage,
			GitBranch:     gitBranch,
			Committer:     committer,
		})
		if err != nil {
			log.Errorf("failed to enqueue deployment job for service %s: %v", service.ID, err)
			return err
		}
	}

	return nil
}

// DeployAdhocServices deploys services that need an ad-hoc deployment (config changes only)
func (self *ServiceService) DeployAdhocServices(ctx context.Context, services []*ent.Service) ([]*ent.Deployment, error) {
	var newDeployments []*ent.Deployment

	for _, service := range services {
		deployment, err := self.deployAdhocService(ctx, service)
		if err != nil {
			return nil, fmt.Errorf("failed to deploy service %s: %w", service.ID, err)
		}
		if deployment != nil {
			newDeployments = append(newDeployments, deployment)
		}
	}

	return newDeployments, nil
}

// deployAdhocService handles the adhoc deployment of a single service
func (self *ServiceService) deployAdhocService(ctx context.Context, service *ent.Service) (*ent.Deployment, error) {
	if service.Edges.CurrentDeployment == nil || service.Edges.ServiceConfig == nil {
		return nil, fmt.Errorf("service %s missing current deployment or config", service.ID)
	}

	// Create CRD to deploy
	crdToDeploy := self.deploymentService.CreateCRDFromService(service)

	var newDeployment *ent.Deployment

	// Deploy the new CRD
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		// Create a record in the database
		commitSha := ""
		if service.Edges.CurrentDeployment.CommitSha != nil {
			commitSha = *service.Edges.CurrentDeployment.CommitSha
		}
		commitMessage := ""
		if service.Edges.CurrentDeployment.CommitMessage != nil {
			commitMessage = *service.Edges.CurrentDeployment.CommitMessage
		}

		var err error
		var gitBranch string
		if service.Edges.CurrentDeployment.GitBranch != nil {
			gitBranch = *service.Edges.CurrentDeployment.GitBranch
		}
		newDeployment, err = self.repo.Deployment().Create(
			ctx,
			tx,
			service.Edges.CurrentDeployment.ServiceID,
			commitSha,
			commitMessage,
			gitBranch,
			service.Edges.CurrentDeployment.CommitAuthor,
			service.Edges.CurrentDeployment.Source,
			schema.DeploymentStatusBuildQueued,
		)
		if err != nil {
			return err
		}
		crdToDeploy.Spec.DeploymentRef = newDeployment.ID.String()

		// Mark the deployment as started
		if _, err := self.repo.Deployment().MarkStarted(ctx, tx, newDeployment.ID, time.Now()); err != nil {
			return err
		}

		// Resolve references
		additionalEnv, err := self.variableService.ResolveAllReferences(ctx, service.ID)
		if err != nil {
			// Mark failed
			if _, err := self.repo.Deployment().MarkFailed(ctx, tx, newDeployment.ID, err.Error(), time.Now()); err != nil {
				return err
			}
			return err
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

		crdToDeploy.Spec.EnvVars = envVars

		// Deploy to kubernetes
		_, newService, err := self.k8s.DeployUnbindService(ctx, crdToDeploy)
		if err != nil {
			// Mark failed
			if _, err := self.repo.Deployment().MarkFailed(ctx, tx, newDeployment.ID, err.Error(), time.Now()); err != nil {
				return err
			}
			// Pass through since we already marked the deployment as failed
			return nil
		}

		// Attach metadata
		if _, err := self.repo.Deployment().AttachDeploymentMetadata(
			ctx,
			tx,
			newDeployment.ID,
			crdToDeploy.Spec.Config.Image,
			newService,
		); err != nil {
			// Mark failed
			if _, err := self.repo.Deployment().MarkFailed(ctx, tx, newDeployment.ID, err.Error(), time.Now()); err != nil {
				return err
			}
			// Pass through since we already marked the deployment as failed
			return nil
		}

		// Mark as succeeded
		if _, err := self.repo.Deployment().MarkSucceeded(ctx, tx, newDeployment.ID, time.Now()); err != nil {
			return err
		}

		// Update the service with the new deployment
		if err := self.repo.Service().SetCurrentDeployment(ctx, tx, service.ID, newDeployment.ID); err != nil {
			return err
		}

		return nil
	}); err != nil {
		log.Errorf("failed to deploy new CRD for service %s: %v", service.ID, err)
		return nil, err
	}

	return newDeployment, nil
}

// RedeployServices determines which services need rebuilding vs redeploying and performs the appropriate action
func (self *ServiceService) RedeployServices(ctx context.Context, services []*ent.Service) ([]*ent.Deployment, error) {
	var servicesToRebuild []*ent.Service
	var servicesToRedeploy []*ent.Service
	var resultDeployments []*ent.Deployment

	// Categorize services based on deployment needs
	for _, service := range services {
		needsDeploymentType, err := self.repo.Service().NeedsDeployment(ctx, service)
		if err != nil {
			return nil, fmt.Errorf("failed to check deployment needs for service %s: %w", service.ID, err)
		}

		switch needsDeploymentType {
		case service_repo.NeedsBuildAndDeployment:
			servicesToRebuild = append(servicesToRebuild, service)
		case service_repo.NeedsDeployment:
			servicesToRedeploy = append(servicesToRedeploy, service)
		}
	}

	// Handle full rebuilds (note: this doesn't return deployments, it enqueues jobs)
	if len(servicesToRebuild) > 0 {
		if err := self.EnqueueFullBuildDeployments(ctx, servicesToRebuild); err != nil {
			return nil, fmt.Errorf("failed to enqueue build deployments: %w", err)
		}
	}

	// Handle ad-hoc deployments
	if len(servicesToRedeploy) > 0 {
		deployments, err := self.DeployAdhocServices(ctx, servicesToRedeploy)
		if err != nil {
			return nil, fmt.Errorf("failed to deploy services: %w", err)
		}
		resultDeployments = append(resultDeployments, deployments...)
	}

	return resultDeployments, nil
}
