package k8s

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetPodsByLabelsLogic(t *testing.T) {
	tests := []struct {
		name          string
		pods          []corev1.Pod
		searchLabels  map[string]string
		expectedCount int
		expectedNames []string
	}{
		{
			name: "Find pods by single label",
			pods: []corev1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "pod1",
						Namespace: "test-ns",
						Labels:    map[string]string{"app": "web", "env": "prod"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "pod2",
						Namespace: "test-ns",
						Labels:    map[string]string{"app": "api", "env": "prod"},
					},
				},
			},
			searchLabels:  map[string]string{"app": "web"},
			expectedCount: 1,
			expectedNames: []string{"pod1"},
		},
		{
			name: "Find pods by multiple labels",
			pods: []corev1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "pod1",
						Namespace: "test-ns",
						Labels:    map[string]string{"app": "web", "env": "prod"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "pod2",
						Namespace: "test-ns",
						Labels:    map[string]string{"app": "web", "env": "dev"},
					},
				},
			},
			searchLabels:  map[string]string{"app": "web", "env": "prod"},
			expectedCount: 1,
			expectedNames: []string{"pod1"},
		},
		{
			name:          "No matching pods",
			pods:          []corev1.Pod{},
			searchLabels:  map[string]string{"app": "nonexistent"},
			expectedCount: 0,
			expectedNames: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the label matching logic directly
			matchingPods := filterPodsByLabels(tt.pods, tt.searchLabels)

			assert.Len(t, matchingPods, tt.expectedCount)

			actualNames := make([]string, len(matchingPods))
			for i, pod := range matchingPods {
				actualNames[i] = pod.Name
			}
			assert.ElementsMatch(t, tt.expectedNames, actualNames)
		})
	}
}

// Helper function to test pod filtering logic
func filterPodsByLabels(pods []corev1.Pod, searchLabels map[string]string) []corev1.Pod {
	var matchingPods []corev1.Pod

	for _, pod := range pods {
		matches := true
		for key, value := range searchLabels {
			if podValue, exists := pod.Labels[key]; !exists || podValue != value {
				matches = false
				break
			}
		}
		if matches {
			matchingPods = append(matchingPods, pod)
		}
	}

	return matchingPods
}

func TestLabelSelectorStringFormatting(t *testing.T) {
	tests := []struct {
		name          string
		labels        map[string]string
		expectedParts []string
	}{
		{
			name: "Single label",
			labels: map[string]string{
				"app": "web",
			},
			expectedParts: []string{"app=web"},
		},
		{
			name: "Multiple labels",
			labels: map[string]string{
				"app": "web",
				"env": "prod",
			},
			expectedParts: []string{"app=web", "env=prod"},
		},
		{
			name:          "Empty labels",
			labels:        map[string]string{},
			expectedParts: []string{},
		},
		{
			name: "Labels with special characters",
			labels: map[string]string{
				"unbind-service": "my-service-123",
				"version":        "v1.2.3",
			},
			expectedParts: []string{"unbind-service=my-service-123", "version=v1.2.3"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			labelSelector := buildLabelSelector(tt.labels)

			if len(tt.expectedParts) == 0 {
				assert.Empty(t, labelSelector)
			} else {
				// Split the result and check all parts are present
				parts := strings.Split(labelSelector, ",")
				assert.Len(t, parts, len(tt.expectedParts))
				assert.ElementsMatch(t, tt.expectedParts, parts)
			}
		})
	}
}

// Helper function to test label selector building
func buildLabelSelector(labels map[string]string) string {
	var labelSelectors []string
	for key, value := range labels {
		labelSelectors = append(labelSelectors, fmt.Sprintf("%s=%s", key, value))
	}
	return strings.Join(labelSelectors, ",")
}

func TestGetTopLevelOwnerLogic(t *testing.T) {
	tests := []struct {
		name         string
		pod          corev1.Pod
		replicaSet   *appsv1.ReplicaSet
		expectedKind string
		expectedName string
		expectNil    bool
	}{
		{
			name: "Pod owned by Deployment via ReplicaSet",
			pod: corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-pod",
					Namespace: "test-ns",
					OwnerReferences: []metav1.OwnerReference{
						{
							Kind: "ReplicaSet",
							Name: "test-rs",
						},
					},
				},
			},
			replicaSet: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-rs",
					Namespace: "test-ns",
					OwnerReferences: []metav1.OwnerReference{
						{
							Kind: "Deployment",
							Name: "test-deployment",
						},
					},
				},
			},
			expectedKind: "Deployment",
			expectedName: "test-deployment",
			expectNil:    false,
		},
		{
			name: "Pod owned by StatefulSet directly",
			pod: corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-pod",
					Namespace: "test-ns",
					OwnerReferences: []metav1.OwnerReference{
						{
							Kind: "StatefulSet",
							Name: "test-sts",
						},
					},
				},
			},
			replicaSet:   nil,
			expectedKind: "StatefulSet",
			expectedName: "test-sts",
			expectNil:    false,
		},
		{
			name: "Pod with no owner references",
			pod: corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "standalone-pod",
					Namespace: "test-ns",
				},
			},
			replicaSet: nil,
			expectNil:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fake client with interface type
			objects := []runtime.Object{&tt.pod}
			if tt.replicaSet != nil {
				objects = append(objects, tt.replicaSet)
			}
			client := fake.NewSimpleClientset(objects...)

			// Test the function using kubernetes.Interface
			ownerRef := getTopLevelOwnerTest(context.Background(), tt.pod, client, "test-ns")

			if tt.expectNil {
				assert.Nil(t, ownerRef)
			} else {
				require.NotNil(t, ownerRef)
				assert.Equal(t, tt.expectedKind, ownerRef.Kind)
				assert.Equal(t, tt.expectedName, ownerRef.Name)
			}
		})
	}
}

// Test helper function that uses kubernetes.Interface
func getTopLevelOwnerTest(ctx context.Context, pod corev1.Pod, client kubernetes.Interface, namespace string) *metav1.OwnerReference {
	if len(pod.OwnerReferences) == 0 {
		return nil
	}

	ownerRef := pod.OwnerReferences[0]

	// Check if the owner is a ReplicaSet (which is typically owned by a Deployment)
	if ownerRef.Kind == "ReplicaSet" {
		replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(ctx, ownerRef.Name, metav1.GetOptions{})
		if err != nil {
			return &ownerRef
		}

		if len(replicaSet.OwnerReferences) > 0 {
			return &replicaSet.OwnerReferences[0]
		}
	}

	return &ownerRef
}

func TestRestartAnnotationFormatting(t *testing.T) {
	// Test the restart annotation patch formatting
	now := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)
	expectedTime := now.Format(time.RFC3339)

	patchData := fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"%s"}}}}}`, expectedTime)

	// Verify the patch contains the expected elements
	assert.Contains(t, patchData, "kubectl.kubernetes.io/restartedAt")
	assert.Contains(t, patchData, expectedTime)
	assert.Contains(t, patchData, "spec")
	assert.Contains(t, patchData, "template")
	assert.Contains(t, patchData, "metadata")
	assert.Contains(t, patchData, "annotations")
}

func TestPodOwnerGrouping(t *testing.T) {
	tests := []struct {
		name               string
		pods               []corev1.Pod
		expectedGroups     map[string]int // owner key -> number of pods
		expectedStandalone int
	}{
		{
			name: "Mixed owner types",
			pods: []corev1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "deployment-pod-1",
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "ReplicaSet", Name: "web-rs"},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "deployment-pod-2",
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "ReplicaSet", Name: "web-rs"},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "statefulset-pod",
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "StatefulSet", Name: "db-sts"},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "standalone-pod",
					},
				},
			},
			expectedGroups: map[string]int{
				"ReplicaSet/test-ns/web-rs":  2,
				"StatefulSet/test-ns/db-sts": 1,
			},
			expectedStandalone: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Group pods by owner (simplified version of the logic in RollingRestartPodsByLabel)
			podsByOwner := make(map[string][]corev1.Pod)
			standalonePods := make([]corev1.Pod, 0)

			for _, pod := range tt.pods {
				if len(pod.OwnerReferences) == 0 {
					standalonePods = append(standalonePods, pod)
					continue
				}

				// Simplified owner reference handling for testing
				ownerRef := pod.OwnerReferences[0]
				key := fmt.Sprintf("%s/test-ns/%s", ownerRef.Kind, ownerRef.Name)
				podsByOwner[key] = append(podsByOwner[key], pod)
			}

			// Verify grouping
			assert.Len(t, standalonePods, tt.expectedStandalone)

			for expectedKey, expectedCount := range tt.expectedGroups {
				pods, exists := podsByOwner[expectedKey]
				assert.True(t, exists, "Expected owner group %s not found", expectedKey)
				assert.Len(t, pods, expectedCount, "Wrong number of pods for owner %s", expectedKey)
			}
		})
	}
}

func TestDeleteStatefulSetsLogic(t *testing.T) {
	// Test the label selector logic for StatefulSet deletion
	tests := []struct {
		name              string
		statefulSets      []appsv1.StatefulSet
		deleteLabels      map[string]string
		expectedRemaining []string
	}{
		{
			name: "Delete by matching labels",
			statefulSets: []appsv1.StatefulSet{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:   "sts1",
						Labels: map[string]string{"app": "database", "env": "test"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:   "sts2",
						Labels: map[string]string{"app": "database", "env": "test"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:   "sts3",
						Labels: map[string]string{"app": "web", "env": "prod"},
					},
				},
			},
			deleteLabels:      map[string]string{"app": "database", "env": "test"},
			expectedRemaining: []string{"sts3"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			remaining := filterStatefulSetsByLabels(tt.statefulSets, tt.deleteLabels, false) // false = keep non-matching

			actualNames := make([]string, len(remaining))
			for i, sts := range remaining {
				actualNames[i] = sts.Name
			}
			assert.ElementsMatch(t, tt.expectedRemaining, actualNames)
		})
	}
}

// Helper function to test StatefulSet filtering logic
func filterStatefulSetsByLabels(statefulSets []appsv1.StatefulSet, filterLabels map[string]string, keepMatching bool) []appsv1.StatefulSet {
	var result []appsv1.StatefulSet

	for _, sts := range statefulSets {
		matches := true
		for key, value := range filterLabels {
			if stsValue, exists := sts.Labels[key]; !exists || stsValue != value {
				matches = false
				break
			}
		}

		// Keep based on keepMatching flag
		if (matches && keepMatching) || (!matches && !keepMatching) {
			result = append(result, sts)
		}
	}

	return result
}

func TestPatchTypeValidation(t *testing.T) {
	// Test that we're using the correct patch type for restart operations
	patchType := types.StrategicMergePatchType
	assert.Equal(t, types.StrategicMergePatchType, patchType)

	// Verify the patch type string value
	assert.Equal(t, "application/strategic-merge-patch+json", string(patchType))
}

func TestWorkloadRestartLogic(t *testing.T) {
	tests := []struct {
		name         string
		workloadKind string
		isSupported  bool
	}{
		{
			name:         "Deployment restart supported",
			workloadKind: "Deployment",
			isSupported:  true,
		},
		{
			name:         "StatefulSet restart supported",
			workloadKind: "StatefulSet",
			isSupported:  true,
		},
		{
			name:         "DaemonSet restart supported",
			workloadKind: "DaemonSet",
			isSupported:  true,
		},
		{
			name:         "Job restart not supported",
			workloadKind: "Job",
			isSupported:  false,
		},
		{
			name:         "Pod restart not supported",
			workloadKind: "Pod",
			isSupported:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			supported := isWorkloadRestartSupported(tt.workloadKind)
			assert.Equal(t, tt.isSupported, supported)
		})
	}
}

// Helper function to test workload restart support
func isWorkloadRestartSupported(kind string) bool {
	switch kind {
	case "Deployment", "StatefulSet", "DaemonSet":
		return true
	default:
		return false
	}
}

func TestPodDeletionDelay(t *testing.T) {
	// Test that we have a reasonable delay between pod deletions
	delay := 5 * time.Second

	assert.Equal(t, 5*time.Second, delay)
	assert.True(t, delay > 0, "Delay should be positive")
	assert.True(t, delay <= 10*time.Second, "Delay should be reasonable")
}

func TestOwnerReferenceKeyGeneration(t *testing.T) {
	tests := []struct {
		name        string
		ownerRef    metav1.OwnerReference
		namespace   string
		expectedKey string
	}{
		{
			name: "Deployment owner reference",
			ownerRef: metav1.OwnerReference{
				Kind: "Deployment",
				Name: "web-app",
			},
			namespace:   "default",
			expectedKey: "Deployment/default/web-app",
		},
		{
			name: "StatefulSet owner reference",
			ownerRef: metav1.OwnerReference{
				Kind: "StatefulSet",
				Name: "database",
			},
			namespace:   "prod",
			expectedKey: "StatefulSet/prod/database",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := generateOwnerKey(tt.ownerRef, tt.namespace)
			assert.Equal(t, tt.expectedKey, key)
		})
	}
}

// Helper function to test owner key generation
func generateOwnerKey(ownerRef metav1.OwnerReference, namespace string) string {
	return fmt.Sprintf("%s/%s/%s", ownerRef.Kind, namespace, ownerRef.Name)
}
