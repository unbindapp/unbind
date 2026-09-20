package dbvolumes

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	"k8s.io/client-go/kubernetes"
)

// LoadNames is ResolveNames with the names read from the database
func LoadNames(ctx context.Context, tx repository.TxInterface, repo repositories.RepositoriesInterface, pvcs []*models.PVCInfo) error {
	ids := make([]string, len(pvcs))
	for i, pvc := range pvcs {
		ids[i] = pvc.ID
	}

	metadata, err := repo.System().GetPVCMetadata(ctx, tx, ids)
	if err != nil {
		return err
	}

	var serviceNames map[uuid.UUID]string
	if serviceIDs := ServiceIDsNeedingNames(pvcs, metadata); len(serviceIDs) > 0 {
		serviceNames, err = repo.Service().GetNamesByIDs(ctx, serviceIDs)
		if err != nil {
			return err
		}
	}

	ResolveNames(pvcs, metadata, serviceNames)
	return nil
}

// LoadName names a single volume, which takes naming every volume of its scope
func LoadName(ctx context.Context, tx repository.TxInterface, repo repositories.RepositoriesInterface, kube k8s.KubeClientInterface, namespace string, pvc *models.PVCInfo, client kubernetes.Interface) error {
	siblings, err := loadScope(ctx, tx, repo, kube, namespace, pvc, client)
	if err != nil {
		return err
	}

	for _, sibling := range siblings {
		if sibling.ID == pvc.ID {
			pvc.Name = sibling.Name
			pvc.Description = sibling.Description
			return nil
		}
	}
	return LoadNames(ctx, tx, repo, []*models.PVCInfo{pvc})
}

// TakenNames lists the names a volume in the scope of pvc cannot have. pvc does not have to exist yet.
func TakenNames(ctx context.Context, tx repository.TxInterface, repo repositories.RepositoriesInterface, kube k8s.KubeClientInterface, namespace string, pvc *models.PVCInfo, client kubernetes.Interface) ([]string, error) {
	siblings, err := loadScope(ctx, tx, repo, kube, namespace, pvc, client)
	if err != nil {
		return nil, err
	}

	var taken []string
	for _, sibling := range siblings {
		if sibling.ID != pvc.ID && ScopeKey(sibling) == ScopeKey(pvc) {
			taken = append(taken, sibling.Name)
		}
	}
	return taken, nil
}

func loadScope(ctx context.Context, tx repository.TxInterface, repo repositories.RepositoriesInterface, kube k8s.KubeClientInterface, namespace string, pvc *models.PVCInfo, client kubernetes.Interface) ([]*models.PVCInfo, error) {
	siblings, err := kube.ListPersistentVolumeClaims(ctx, namespace, ScopeLabels(pvc), client)
	if err != nil {
		return nil, err
	}
	if err := LoadNames(ctx, tx, repo, siblings); err != nil {
		return nil, err
	}
	return siblings, nil
}
