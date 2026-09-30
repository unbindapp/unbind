package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation"
)

func prepullTestDeployment(image string) *appsv1.Deployment {
	selector := map[string]string{"app.kubernetes.io/name": "app"}
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "app", Namespace: "team"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: selector},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{
					"app.kubernetes.io/name": "app",
					"unbind-service":         "service-id",
					"unbind-deployment":      "deployment-id",
				}},
				Spec: corev1.PodSpec{
					ImagePullSecrets: []corev1.LocalObjectReference{{Name: "registry"}},
					InitContainers: []corev1.Container{
						{Name: "init-0", Image: "migrate:1", Command: []string{"migrate"}},
						{Name: "init-1", Image: image},
					},
					Containers: []corev1.Container{{
						Name:            "app",
						Image:           image,
						ImagePullPolicy: corev1.PullAlways,
						VolumeMounts:    []corev1.VolumeMount{{Name: "data", MountPath: "/data"}},
					}},
					Volumes: []corev1.Volume{{Name: "data"}},
				},
			},
		},
	}
}

func TestNeedsPrepull(t *testing.T) {
	serving := prepullTestDeployment("app:1")
	serving.Status.ReadyReplicas = 1

	assert.True(t, needsPrepull(serving, prepullTestDeployment("app:2")))
	assert.False(t, needsPrepull(serving, prepullTestDeployment("app:1")), "the replica is not replaced")

	redeployed := prepullTestDeployment("app:1")
	redeployed.Spec.Template.Labels["unbind-deployment"] = "next-deployment-id"
	assert.True(t, needsPrepull(serving, redeployed), "the tag may point at a new image")

	assert.False(t, needsPrepull(prepullTestDeployment("app:1"), prepullTestDeployment("app:2")), "no replica is serving")
}

func TestPrepullJob(t *testing.T) {
	job := prepullJob(prepullTestDeployment("app:2"))
	pod := job.Spec.Template

	images := make([]string, 0, len(pod.Spec.Containers))
	for _, container := range pod.Spec.Containers {
		images = append(images, container.Image)
		assert.Equal(t, []string{prepullCommand}, container.Command, "nothing from the image runs")
		assert.Empty(t, container.VolumeMounts)
	}
	assert.Equal(t, []string{"migrate:1", "app:2"}, images, "every image once, init containers included")
	assert.Empty(t, pod.Spec.InitContainers)
	assert.Empty(t, pod.Spec.Volumes, "the volume stays with the running replica")
	assert.Equal(t, []corev1.LocalObjectReference{{Name: "registry"}}, pod.Spec.ImagePullSecrets)

	assert.Equal(t, map[string]string{
		"unbind-service":    "service-id",
		"unbind-deployment": "deployment-id",
		v1.PrepullLabel:     "true",
	}, pod.Labels, "the pod is never matched by the deployment or its service")
}

func TestPrepullJobName(t *testing.T) {
	assert.Equal(t, "app-prepull", prepullJobName("app"))

	long := "a-service-name-that-is-as-long-as-kubernetes-lets-a-name-be-1234"
	assert.Empty(t, validation.IsDNS1123Label(prepullJobName(long)))
}
