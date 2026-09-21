package environment_service

import (
	"context"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
)

// Teardown removes an environment with its services, service groups, volumes and secrets.
// Every cluster delete tolerates a missing resource, so a failed run can be retried.
func Teardown(
	ctx context.Context,
	tx repository.TxInterface,
	repo repositories.RepositoriesInterface,
	k8sClient k8s.KubeClientInterface,
	deployCtl deployctl.DeploymentControllerInterface,
	client kubernetes.Interface,
	namespace string,
	environment *ent.Environment,
	services []*ent.Service,
) error {
	for _, service := range services {
		if err := deployCtl.CancelExistingJobs(ctx, service.ID); err != nil {
			log.Warnf("Error cancelling jobs for service %s: %v", service.KubernetesName, err)
		}

		if err := k8sClient.DeleteUnbindService(ctx, namespace, service.KubernetesName); err != nil {
			log.Error("Error deleting service from k8s", "svc", service.KubernetesName, "err", err)
			return err
		}

		if err := k8sClient.DeleteSecret(ctx, service.KubernetesSecret, namespace, client); err != nil && !errors.IsNotFound(err) {
			log.Error("Error deleting secret from k8s", "secret", service.KubernetesSecret, "err", err)
			return err
		}

		if err := repo.Service().Delete(ctx, tx, service.ID); err != nil {
			return err
		}
	}

	deletedVolumes, err := k8sClient.DeletePersistentVolumeClaimsForEnvironment(ctx, namespace, environment.ID, client)
	if err != nil {
		log.Error("Error deleting volumes from k8s", "environment", environment.ID, "err", err)
		return err
	}
	for _, volume := range deletedVolumes {
		if err := repo.System().DeletePVCMetadata(ctx, tx, volume); err != nil {
			return err
		}
	}

	if err := repo.ServiceGroup().DeleteByEnvironmentID(ctx, tx, environment.ID); err != nil {
		return err
	}

	if err := k8sClient.DeleteSecret(ctx, environment.KubernetesSecret, namespace, client); err != nil && !errors.IsNotFound(err) {
		log.Error("Error deleting secret", "secret", environment.KubernetesSecret, "err", err)
		return err
	}

	return repo.Environment().Delete(ctx, tx, environment.ID)
}
