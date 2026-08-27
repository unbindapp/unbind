// Package dbvolumes names and provisions the PVCs a database service mounts, so unbind owns
// their size and lifetime instead of the engines' operators.
package dbvolumes

import (
	"context"
	"fmt"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/pkg/databases"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const DefaultStorage = "1Gi"

const EngineLabel = "unbind-database"

// services created before unbind managed database volumes have an empty volume set and stay
// on their operator's storage
func Managed(service *ent.Service) bool {
	return service != nil &&
		service.Type == schema.ServiceTypeDatabase &&
		service.Edges.ServiceConfig != nil &&
		len(service.Edges.ServiceConfig.Volumes) > 0
}

func SharesOneClaim(dbType string) bool {
	return databases.MountsExistingClaim(dbType)
}

func PrimaryVolume(service *ent.Service, attached []schema.ServiceVolume) ([]schema.ServiceVolume, error) {
	if service.Type != schema.ServiceTypeDatabase || service.Database == nil || service.Edges.ServiceConfig == nil {
		return nil, nil
	}

	current := ""
	if volumes := service.Edges.ServiceConfig.Volumes; len(volumes) > 0 {
		current = volumes[0].ID
	}
	if len(attached) > 0 {
		current = attached[0].ID
	}

	return PrimaryVolumeFor(*service.Database, service.KubernetesName, service.ID.String(), service.Name, service.Edges.ServiceConfig.Replicas, current)
}

// nil means unbind does not manage this storage: unsupported engines, and replicated
// redis/mongodb whose charts point every replica at the same claim when given one by name
func PrimaryVolumeFor(dbType, kubernetesName, serviceID, displayName string, replicas int32, current string) ([]schema.ServiceVolume, error) {
	mountPath := utils.InferOperatorPVCMountPath(dbType)
	if mountPath == nil {
		return nil, nil
	}

	if !SharesOneClaim(dbType) {
		names := databases.StatefulSetClaimNames(dbType, kubernetesName, serviceID, 1)
		return []schema.ServiceVolume{{ID: names[0], MountPath: *mountPath}}, nil
	}
	if replicas > 1 {
		return nil, nil
	}
	if current == "" {
		generated, err := utils.GenerateSlug(displayName)
		if err != nil {
			return nil, err
		}
		current = generated
	}
	return []schema.ServiceVolume{{ID: current, MountPath: *mountPath}}, nil
}

func claimNames(service *ent.Service, replicas int) []string {
	if replicas < 1 {
		replicas = 1
	}
	dbType := *service.Database
	if SharesOneClaim(dbType) {
		return []string{service.Edges.ServiceConfig.Volumes[0].ID}
	}
	return databases.StatefulSetClaimNames(dbType, service.KubernetesName, service.ID.String(), replicas)
}

// idempotent, runs before every deploy; replica scale-ups get their claims here
func Ensure(ctx context.Context, kube k8s.KubeClientInterface, service *ent.Service, client kubernetes.Interface) error {
	if !Managed(service) {
		return nil
	}
	namespace, err := Namespace(service)
	if err != nil {
		return err
	}
	labels, err := Labels(service)
	if err != nil {
		return err
	}

	config := service.Edges.ServiceConfig
	storage := DefaultStorage
	if config.DatabaseConfig != nil && config.DatabaseConfig.StorageSize != "" {
		storage = config.DatabaseConfig.StorageSize
	}

	claims := claimNames(service, int(config.Replicas))

	// the recorded size is frozen at creation and resizes land on the claims, so a claim
	// created after a resize must match its siblings to hold a clone of the primary
	grown, err := largestClaimRequest(ctx, namespace, claims, storage, client)
	if err != nil {
		return err
	}
	storage = grown

	for _, claim := range claims {
		if _, err := kube.EnsurePersistentVolumeClaim(
			ctx,
			namespace,
			claim,
			service.Name,
			labels,
			storage,
			[]corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			nil,
			client,
		); err != nil {
			return err
		}
		if err := kube.RetainVolumeForClaim(ctx, namespace, claim, client); err != nil {
			return err
		}
	}
	return nil
}

func largestClaimRequest(ctx context.Context, namespace string, claims []string, fallback string, client kubernetes.Interface) (string, error) {
	largest, err := resource.ParseQuantity(fallback)
	if err != nil {
		return "", fmt.Errorf("invalid storage size %q: %w", fallback, err)
	}

	result := fallback
	for _, claim := range claims {
		pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, claim, metav1.GetOptions{})
		if err != nil {
			if errors.IsNotFound(err) {
				continue
			}
			return "", fmt.Errorf("failed to get PersistentVolumeClaim %q: %w", claim, err)
		}
		request, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]
		if !ok || request.Cmp(largest) <= 0 {
			continue
		}
		largest = request
		result = request.String()
	}
	return result, nil
}

func Claims(service *ent.Service) []string {
	if !Managed(service) {
		return nil
	}
	return claimNames(service, int(service.Edges.ServiceConfig.Replicas))
}

func Labels(service *ent.Service) (map[string]string, error) {
	environment := service.Edges.Environment
	if environment == nil || environment.Edges.Project == nil || environment.Edges.Project.Edges.Team == nil {
		return nil, fmt.Errorf("service %s is missing environment, project or team edges", service.ID)
	}
	labels := map[string]string{
		"unbind-team":        environment.Edges.Project.Edges.Team.ID.String(),
		"unbind-project":     environment.Edges.Project.ID.String(),
		"unbind-environment": environment.ID.String(),
		"unbind-service":     service.ID.String(),
	}
	if service.Database != nil {
		labels[EngineLabel] = *service.Database
	}
	return labels, nil
}

func Namespace(service *ent.Service) (string, error) {
	environment := service.Edges.Environment
	if environment == nil || environment.Edges.Project == nil || environment.Edges.Project.Edges.Team == nil {
		return "", fmt.Errorf("service %s is missing environment, project or team edges", service.ID)
	}
	return environment.Edges.Project.Edges.Team.Namespace, nil
}
