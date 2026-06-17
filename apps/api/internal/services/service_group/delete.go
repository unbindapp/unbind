package servicegroup_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *ServiceGroupService) DeleteServiceGroup(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.DeleteServiceGroupInput) error {
	// Check permissions
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage teams
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	// Verify inputs
	env, project, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return err
	}
	if env.ID != input.EnvironmentID {
		return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
	}

	// * Delete services too
	if input.DeleteServices {
		// Get services in this group
		services, err := self.repo.ServiceGroup().GetServices(ctx, input.ID)
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
			namespace := project.Edges.Team.Namespace
			// Delete services
			for _, service := range services {
				// Cancel deployments
				if err := self.deployCtl.CancelExistingJobs(ctx, service.ID); err != nil {
					log.Warnf("Error cancelling jobs for service %s: %v", service.KubernetesName, err)
				}

				if err := self.k8s.DeleteUnbindService(ctx, namespace, service.KubernetesName); err != nil {
					log.Error("Error deleting service from k8s", "svc", service.KubernetesName, "err", err)

					return err
				}

				// Delete secret
				if err := self.k8s.DeleteSecret(ctx, service.KubernetesSecret, namespace, client); err != nil {
					log.Error("Error deleting secret from k8s", "secret", service.KubernetesSecret, "err", err)
					return err
				}

				if err := self.repo.Service().Delete(ctx, tx, service.ID); err != nil {
					return err
				}
			}

			// Delete service group
			if err := self.repo.ServiceGroup().Delete(ctx, tx, input.ID); err != nil {
				return err
			}

			return nil
		}); err != nil {
			return err
		}

		return nil
	}

	// * Just delete the service group
	return self.repo.ServiceGroup().Delete(ctx, nil, input.ID)
}
