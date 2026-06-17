package environment_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *EnvironmentService) DeleteEnvironmentByID(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, teamID, projectID, environmentID uuid.UUID) error {
	// Check permissions
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   environmentID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	// Verify inputs
	team, environment, err := self.VerifyInputs(ctx, teamID, projectID, environmentID)
	if err != nil {
		return err
	}

	// Get services in this environment
	services, err := self.repo.Service().GetByEnvironmentID(ctx, environmentID, nil, false)
	if err != nil {
		return err
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return err
	}

	// Delete kubernetes resources, db resource
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		// Make sure this isn't the only environment in the project
		projectEnvs, err := self.repo.Environment().GetForProject(ctx, tx, projectID, nil)
		if err != nil {
			return err
		}
		if len(projectEnvs) <= 1 {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Cannot delete the last environment in a project")
		}

		// Delete services
		for _, service := range services {
			// Cancel deployments
			if err := self.deployCtl.CancelExistingJobs(ctx, service.ID); err != nil {
				log.Warnf("Error cancelling jobs for service %s: %v", service.KubernetesName, err)
			}

			if err := self.k8s.DeleteUnbindService(ctx, team.Namespace, service.KubernetesName); err != nil {
				log.Error("Error deleting service from k8s", "svc", service.KubernetesName, "err", err)

				return err
			}

			// Delete secret
			if err := self.k8s.DeleteSecret(ctx, service.KubernetesSecret, team.Namespace, client); err != nil {
				log.Error("Error deleting secret from k8s", "secret", service.KubernetesSecret, "err", err)
				return err
			}

			if err := self.repo.Service().Delete(ctx, tx, service.ID); err != nil {
				return err
			}
		}

		// Delete any service groups in this environment
		if err := self.repo.ServiceGroup().DeleteByEnvironmentID(ctx, tx, environmentID); err != nil {
			return err
		}

		// Delete environment
		if err := self.k8s.DeleteSecret(ctx, environment.KubernetesSecret, team.Namespace, client); err != nil {
			log.Error("Error deleting secret", "secret", environment.KubernetesSecret, "err", err)
		}

		if err := self.repo.Environment().Delete(ctx, tx, environmentID); err != nil {
			return err
		}

		// Re-fetch environments to update project default
		envs, err := self.repo.Environment().GetForProject(ctx, tx, projectID, nil)
		if err != nil {
			log.Warnf("Error fetching environments for project %s: %v", projectID, err)
		}

		if len(envs) > 0 {
			_, err := self.repo.Project().Update(ctx, tx, projectID, &envs[0].ID, "", nil)
			if err != nil {
				log.Warnf("Error updating project %s default environment: %v", projectID, err)
			}
		} else {
			// Clear default environment
			err = self.repo.Project().ClearDefaultEnvironment(ctx, tx, projectID)
			if err != nil {
				log.Warnf("Error clearing default environment for project %s: %v", projectID, err)
			}
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}
