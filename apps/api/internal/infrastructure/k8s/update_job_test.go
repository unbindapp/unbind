package k8s

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	mocks_config "github.com/unbindapp/unbind-api/mocks/config"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
)

var jobsGVR = schema.GroupVersionResource{Group: "batch", Version: "v1", Resource: "jobs"}

func newUpdateJobClient(t *testing.T, decorateStatus func(*batchv1.Job)) (*KubeClient, *k8sfake.Clientset) {
	t.Helper()

	mockConfig := &mocks_config.ConfigMock{}
	mockConfig.On("GetSystemNamespace").Return("unbind-system")
	mockConfig.On("GetUpdaterServiceAccount").Return("unbind-updater-sa")

	client := k8sfake.NewClientset()
	client.PrependReactor("get", "jobs", func(action clienttesting.Action) (bool, runtime.Object, error) {
		get := action.(clienttesting.GetAction)
		obj, err := client.Tracker().Get(jobsGVR, get.GetNamespace(), get.GetName())
		if err != nil {
			return true, nil, err
		}
		job := obj.(*batchv1.Job)
		decorateStatus(job)
		return true, job, nil
	})

	return &KubeClient{
		config:                mockConfig,
		clientset:             client,
		updateJobPollInterval: 5 * time.Millisecond,
	}, client
}

func TestRunManifestApplyJob_Success(t *testing.T) {
	kubeClient, client := newUpdateJobClient(t, func(job *batchv1.Job) {
		job.Status.Succeeded = 1
		job.Status.CompletionTime = &metav1.Time{Time: time.Now()}
	})

	var createdJob *batchv1.Job
	client.PrependReactor("create", "jobs", func(action clienttesting.Action) (bool, runtime.Object, error) {
		createdJob = action.(clienttesting.CreateAction).GetObject().(*batchv1.Job)
		return false, nil, nil
	})

	err := kubeClient.RunManifestApplyJob(context.Background(), "v1.2.3", "ghcr.io/unbindapp/unbind:v1.2.2", []byte("kind: ConfigMap"))
	require.NoError(t, err)

	require.NotNil(t, createdJob)
	assert.Equal(t, "unbind-update-apply-v1-2-3", createdJob.Name)
	podSpec := createdJob.Spec.Template.Spec
	assert.Equal(t, "unbind-updater-sa", podSpec.ServiceAccountName)
	assert.Equal(t, corev1.RestartPolicyNever, podSpec.RestartPolicy)
	require.Len(t, podSpec.Containers, 1)
	container := podSpec.Containers[0]
	assert.Equal(t, "ghcr.io/unbindapp/unbind:v1.2.2", container.Image)
	assert.Equal(t, []string{"/app/cli", "update:apply-manifests", "--file", "/manifests/manifests.yaml"}, container.Command)
	assert.Equal(t, corev1.TerminationMessageFallbackToLogsOnError, container.TerminationMessagePolicy)

	_, err = client.Tracker().Get(jobsGVR, "unbind-system", "unbind-update-apply-v1-2-3")
	assert.True(t, apierrors.IsNotFound(err))
	_, err = client.CoreV1().ConfigMaps("unbind-system").Get(context.Background(), "unbind-update-apply-v1-2-3", metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(err))
}

func TestRunManifestApplyJob_FailureSurfacesReason(t *testing.T) {
	kubeClient, _ := newUpdateJobClient(t, func(job *batchv1.Job) {
		job.Status.Failed = 1
		job.Status.Conditions = []batchv1.JobCondition{
			{
				Type:               batchv1.JobFailed,
				Status:             corev1.ConditionTrue,
				Reason:             "BackoffLimitExceeded",
				Message:            "manifest apply exited 1",
				LastTransitionTime: metav1.Time{Time: time.Now()},
			},
		}
	})

	err := kubeClient.RunManifestApplyJob(context.Background(), "v1.2.3", "ghcr.io/unbindapp/unbind:v1.2.2", []byte("kind: ConfigMap"))

	assert.ErrorContains(t, err, "BackoffLimitExceeded: manifest apply exited 1")
}

func TestRunManifestApplyJob_ReplacesLeftoverJob(t *testing.T) {
	kubeClient, client := newUpdateJobClient(t, func(job *batchv1.Job) {
		job.Status.Succeeded = 1
		job.Status.CompletionTime = &metav1.Time{Time: time.Now()}
	})

	leftoverJob := &batchv1.Job{ObjectMeta: metav1.ObjectMeta{Name: "unbind-update-apply-v1-2-3", Namespace: "unbind-system"}}
	leftoverConfigMap := &corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "unbind-update-apply-v1-2-3", Namespace: "unbind-system"}}
	require.NoError(t, client.Tracker().Add(leftoverJob))
	require.NoError(t, client.Tracker().Add(leftoverConfigMap))

	err := kubeClient.RunManifestApplyJob(context.Background(), "v1.2.3", "ghcr.io/unbindapp/unbind:v1.2.2", []byte("kind: ConfigMap"))
	require.NoError(t, err)

	verbs := make([]string, 0)
	for _, action := range client.Actions() {
		if action.GetResource() == jobsGVR {
			verbs = append(verbs, action.GetVerb())
		}
	}
	assert.Equal(t, "delete", verbs[0])
	assert.Contains(t, verbs, "create")
}
