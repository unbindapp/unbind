package dbvolumes

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_service "github.com/unbindapp/unbind-api/mocks/repository/service"
	mocks_repository_system "github.com/unbindapp/unbind-api/mocks/repository/system"
)

// storedNames stands in for the pvc_metadata table
func reposWithStoredNames(t *testing.T, stored map[string]string, serviceNames map[uuid.UUID]string) *mocks_repositories.RepositoriesMock {
	system := mocks_repository_system.NewSystemRepositoryMock(t)
	system.EXPECT().GetPVCMetadata(mock.Anything, mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, _ repository.TxInterface, ids []string) (map[string]*ent.PVCMetadata, error) {
			metadata := map[string]*ent.PVCMetadata{}
			for _, id := range ids {
				if name, ok := stored[id]; ok {
					metadata[id] = &ent.PVCMetadata{PvcID: id, Name: &name}
				}
			}
			return metadata, nil
		}).Maybe()
	system.EXPECT().UpsertPVCMetadata(mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, _ repository.TxInterface, id string, name, _ *string) error {
			stored[id] = *name
			return nil
		}).Maybe()

	services := mocks_repository_service.NewServiceRepositoryMock(t)
	services.EXPECT().GetNamesByIDs(mock.Anything, mock.Anything).Return(serviceNames, nil).Maybe()

	repo := mocks_repositories.NewRepositoriesMock(t)
	repo.EXPECT().System().Return(system).Maybe()
	repo.EXPECT().Service().Return(services).Maybe()
	return repo
}

func TestStoredDefaultNameSurvivesItsSiblings(t *testing.T) {
	ctx := context.Background()
	environmentID, serviceID := uuid.New(), uuid.New()
	created := time.Date(2026, 9, 20, 0, 0, 0, 0, time.UTC)

	released := func() *models.PVCInfo {
		return &models.PVCInfo{ID: "pgdata-postgresql-aaa-0", IsDatabase: true, EnvironmentID: &environmentID, CreatedAt: created}
	}
	attached := func() *models.PVCInfo {
		return &models.PVCInfo{ID: "pgdata-postgresql-bbb-0", IsDatabase: true, EnvironmentID: &environmentID, MountedOnServiceID: &serviceID, CreatedAt: created.Add(time.Hour)}
	}

	stored := map[string]string{"pgdata-postgresql-aaa-0": "postgresql-volume"}
	repo := reposWithStoredNames(t, stored, map[uuid.UUID]string{serviceID: "PostgreSQL"})

	require.NoError(t, StoreDefaultNames(ctx, repo, []*models.PVCInfo{released(), attached()}))
	suffixed := stored["pgdata-postgresql-bbb-0"]
	assert.Regexp(t, regexp.MustCompile(`^postgresql-volume-[a-z0-9]{4}$`), suffixed)
	assert.Equal(t, "postgresql-volume", stored["pgdata-postgresql-aaa-0"], "a name on record is left alone")

	// the released volume is deleted, which frees the plain name
	delete(stored, "pgdata-postgresql-aaa-0")
	remaining := attached()
	require.NoError(t, LoadNames(ctx, nil, repo, []*models.PVCInfo{remaining}))
	assert.Equal(t, suffixed, remaining.Name, "the freed name must not move over to the volume that is left")

	// and storing again changes nothing
	require.NoError(t, StoreDefaultNames(ctx, repo, []*models.PVCInfo{remaining}))
	assert.Equal(t, suffixed, stored["pgdata-postgresql-bbb-0"])
}

func TestStoreDefaultNamesSkipsVolumesThatAreNotDatabases(t *testing.T) {
	stored := map[string]string{}
	repo := reposWithStoredNames(t, stored, nil)

	regular := &models.PVCInfo{ID: "minio-volume-21cl9ijyli5w", TeamID: uuid.New()}
	require.NoError(t, StoreDefaultNames(context.Background(), repo, []*models.PVCInfo{regular}))

	assert.Empty(t, stored, "their fallback is the claim name, which is not a name anyone gave them")
}
