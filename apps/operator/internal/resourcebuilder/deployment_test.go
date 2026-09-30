package resourcebuilder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/util/validation"
)

func TestBuildVolumesNamesArePodSafe(t *testing.T) {
	short := "data-volume-abc123"
	long := "clickhouse-data-chi-clickhouse-ct0m3d4ys4ok-chi-1f26c820-ea-0-0-0"
	otherLong := "clickhouse-data-chi-clickhouse-zz9m3d4ys4ok-chi-1f26c820-ea-0-0-0"
	dotted := "data.with.dots"

	service := &v1.Service{}
	for _, claim := range []string{short, long, otherLong, dotted} {
		service.Spec.Config.Volumes = append(service.Spec.Config.Volumes, v1.VolumeSpec{Name: claim, MountPath: "/" + claim})
	}
	volumes, mounts := NewResourceBuilder(service, nil, nil).buildVolumes()

	assert.Len(t, volumes, 4)
	names := map[string]bool{}
	for i, volume := range volumes {
		assert.Empty(t, validation.IsDNS1123Label(volume.Name), "volume name %q", volume.Name)
		assert.Equal(t, volume.Name, mounts[i].Name)
		assert.Equal(t, service.Spec.Config.Volumes[i].Name, volume.PersistentVolumeClaim.ClaimName)
		names[volume.Name] = true
	}
	assert.Len(t, names, 4, "every claim gets its own volume name")
	assert.Equal(t, short, volumes[0].Name, "a name a pod accepts is kept, so running services are not rolled")
}

func TestReplicasWithVolume(t *testing.T) {
	service := &v1.Service{}
	assert.Equal(t, int32(1), NewResourceBuilder(service, nil, nil).replicas())

	service.Spec.Config.Replicas = new(int32(3))
	assert.Equal(t, int32(3), NewResourceBuilder(service, nil, nil).replicas())

	service.Spec.Config.Volumes = []v1.VolumeSpec{{Name: "data", MountPath: "/data"}}
	assert.Equal(t, int32(1), NewResourceBuilder(service, nil, nil).replicas(), "replicas can't share a volume")
}

func TestTerminationGracePeriod(t *testing.T) {
	service := &v1.Service{}
	service.Spec.Config.Image = "app:1"

	deployment, err := NewResourceBuilder(service, nil, nil).BuildDeployment()
	assert.NoError(t, err)
	assert.Equal(t, int64(5), *deployment.Spec.Template.Spec.TerminationGracePeriodSeconds)

	service.Spec.Config.Volumes = []v1.VolumeSpec{{Name: "data", MountPath: "/data"}}
	deployment, err = NewResourceBuilder(service, nil, nil).BuildDeployment()
	assert.NoError(t, err)
	assert.Equal(t, int64(1), *deployment.Spec.Template.Spec.TerminationGracePeriodSeconds, "the wait is downtime, and 0 lets two replicas overlap")
}
