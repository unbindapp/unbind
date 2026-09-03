package k8s

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_service_repo "github.com/unbindapp/unbind-api/mocks/repository/service"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestLabeledClaimWithoutServiceIsStillBound(t *testing.T) {
	ctx := context.Background()
	serviceID := mustParseUUID(t, "11111111-2222-3333-4444-555555555555")

	claim := boundClaim("my-volume-abc123")
	claim.Labels = map[string]string{
		teamLabel:    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
		serviceLabel: serviceID.String(),
	}
	client := fake.NewSimpleClientset(claim)

	repo := mocks_repositories.NewRepositoriesMock(t)
	serviceRepo := mocks_service_repo.NewServiceRepositoryMock(t)
	serviceRepo.EXPECT().GetByID(mock.Anything, serviceID).Return(nil, &ent.NotFoundError{})
	repo.EXPECT().Service().Return(serviceRepo)
	kube := &KubeClient{clientset: client, repo: repo}

	info, err := kube.GetPersistentVolumeClaim(ctx, rebindNamespace, "my-volume-abc123", client)
	require.NoError(t, err)
	require.NotNil(t, info)
	require.NotNil(t, info.MountedOnServiceID)
	assert.Equal(t, serviceID, *info.MountedOnServiceID)
	assert.True(t, info.IsAttaching)
	assert.False(t, info.IsDetaching)
	assert.False(t, info.IsAvailable)
	assert.False(t, info.CanDelete)
}

func TestReleasePersistentVolumeClaimsForService(t *testing.T) {
	ctx := context.Background()
	serviceID := mustParseUUID(t, "11111111-2222-3333-4444-555555555555")
	otherServiceID := mustParseUUID(t, "99999999-8888-7777-6666-555555555555")

	mine := boundClaim("mine")
	mine.Labels = map[string]string{serviceLabel: serviceID.String()}
	other := boundClaim("other")
	other.Labels = map[string]string{serviceLabel: otherServiceID.String()}
	plain := boundClaim("plain")
	plain.Labels = map[string]string{"unbind-team": "team"}

	client := fake.NewSimpleClientset(mine, other, plain)
	kube := &KubeClient{clientset: client}

	require.NoError(t, kube.ReleasePersistentVolumeClaimsForService(ctx, rebindNamespace, serviceID, client))

	released, err := client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(ctx, "mine", metav1.GetOptions{})
	require.NoError(t, err)
	assert.NotContains(t, released.Labels, serviceLabel)

	untouched, err := client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(ctx, "other", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, otherServiceID.String(), untouched.Labels[serviceLabel])

	kept, err := client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(ctx, "plain", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "team", kept.Labels["unbind-team"])

	require.NoError(t, kube.ReleasePersistentVolumeClaimsForService(ctx, rebindNamespace, serviceID, client))
	assert.Error(t, kube.ReleasePersistentVolumeClaimsForService(ctx, "", serviceID, client))
}
