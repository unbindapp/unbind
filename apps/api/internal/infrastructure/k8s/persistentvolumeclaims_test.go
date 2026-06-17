package k8s

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestCreatePersistentVolumeClaim(t *testing.T) {
	tests := []struct {
		name         string
		pvcName      string
		namespace    string
		storageSize  string
		storageClass string
		accessModes  []corev1.PersistentVolumeAccessMode
		expectedSize resource.Quantity
		expectError  bool
	}{
		{
			name:         "Valid PVC with ReadWriteOnce",
			pvcName:      "test-pvc-rwo",
			namespace:    "default",
			storageSize:  "10Gi",
			storageClass: "fast-ssd",
			accessModes:  []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			expectedSize: resource.MustParse("10Gi"),
			expectError:  false,
		},
		{
			name:         "Valid PVC with ReadWriteMany",
			pvcName:      "test-pvc-rwx",
			namespace:    "default",
			storageSize:  "5Gi",
			storageClass: "shared-storage",
			accessModes:  []corev1.PersistentVolumeAccessMode{corev1.ReadWriteMany},
			expectedSize: resource.MustParse("5Gi"),
			expectError:  false,
		},
		{
			name:        "Invalid storage size",
			pvcName:     "test-pvc-invalid",
			namespace:   "default",
			storageSize: "invalid-size",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.NewSimpleClientset()

			if !tt.expectError {
				// Create PVC using fake client
				pvc := &corev1.PersistentVolumeClaim{
					ObjectMeta: metav1.ObjectMeta{
						Name:      tt.pvcName,
						Namespace: tt.namespace,
						Labels: map[string]string{
							"app.kubernetes.io/managed-by": "unbind",
							"storage.unbind.app/class":     tt.storageClass,
						},
					},
					Spec: corev1.PersistentVolumeClaimSpec{
						AccessModes: tt.accessModes,
						Resources: corev1.VolumeResourceRequirements{
							Requests: corev1.ResourceList{
								corev1.ResourceStorage: tt.expectedSize,
							},
						},
						StorageClassName: &tt.storageClass,
					},
				}

				_, err := client.CoreV1().PersistentVolumeClaims(tt.namespace).Create(context.Background(), pvc, metav1.CreateOptions{})
				require.NoError(t, err)

				// Verify PVC was created correctly
				createdPVC, err := client.CoreV1().PersistentVolumeClaims(tt.namespace).Get(context.Background(), tt.pvcName, metav1.GetOptions{})
				require.NoError(t, err)

				assert.Equal(t, tt.pvcName, createdPVC.Name)
				assert.Equal(t, tt.namespace, createdPVC.Namespace)
				assert.Equal(t, tt.storageClass, *createdPVC.Spec.StorageClassName)
				assert.Equal(t, tt.expectedSize, createdPVC.Spec.Resources.Requests[corev1.ResourceStorage])
				assert.ElementsMatch(t, tt.accessModes, createdPVC.Spec.AccessModes)
			} else {
				// Test parsing invalid storage size
				_, err := resource.ParseQuantity(tt.storageSize)
				assert.Error(t, err)
			}
		})
	}
}

func TestPVCCapacityValidation(t *testing.T) {
	tests := []struct {
		name       string
		capacity   string
		minSize    string
		maxSize    string
		isValid    bool
		expectedGB float64
	}{
		{
			name:       "Valid capacity within range",
			capacity:   "10Gi",
			minSize:    "1Gi",
			maxSize:    "100Gi",
			isValid:    true,
			expectedGB: 10.737,
		},
		{
			name:       "Capacity below minimum",
			capacity:   "500Mi",
			minSize:    "1Gi",
			maxSize:    "100Gi",
			isValid:    false,
			expectedGB: 0.524,
		},
		{
			name:       "Capacity above maximum",
			capacity:   "1Ti",
			minSize:    "1Gi",
			maxSize:    "100Gi",
			isValid:    false,
			expectedGB: 1099.512,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			capacity := resource.MustParse(tt.capacity)
			minSize := resource.MustParse(tt.minSize)
			maxSize := resource.MustParse(tt.maxSize)

			isValid := validatePVCCapacity(capacity, minSize, maxSize)
			assert.Equal(t, tt.isValid, isValid)

			// Test GB conversion
			gb := convertToGB(capacity)
			assert.InDelta(t, tt.expectedGB, gb, 0.001)
		})
	}
}

func TestPVCAccessModeValidation(t *testing.T) {
	tests := []struct {
		name        string
		accessModes []corev1.PersistentVolumeAccessMode
		isValid     bool
		description string
	}{
		{
			name:        "Valid single ReadWriteOnce",
			accessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			isValid:     true,
			description: "Most common access mode",
		},
		{
			name:        "Valid single ReadWriteMany",
			accessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteMany},
			isValid:     true,
			description: "Shared storage access",
		},
		{
			name:        "Invalid empty access modes",
			accessModes: []corev1.PersistentVolumeAccessMode{},
			isValid:     false,
			description: "Must specify at least one access mode",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := validateAccessModes(tt.accessModes)
			assert.Equal(t, tt.isValid, isValid, tt.description)
		})
	}
}

func TestPVCStatusParsing(t *testing.T) {
	tests := []struct {
		name           string
		phase          corev1.PersistentVolumeClaimPhase
		conditions     []corev1.PersistentVolumeClaimCondition
		expectedStatus string
		isReady        bool
	}{
		{
			name:           "Bound PVC",
			phase:          corev1.ClaimBound,
			conditions:     []corev1.PersistentVolumeClaimCondition{},
			expectedStatus: "Bound",
			isReady:        true,
		},
		{
			name:           "Pending PVC",
			phase:          corev1.ClaimPending,
			conditions:     []corev1.PersistentVolumeClaimCondition{},
			expectedStatus: "Pending",
			isReady:        false,
		},
		{
			name:           "Lost PVC",
			phase:          corev1.ClaimLost,
			conditions:     []corev1.PersistentVolumeClaimCondition{},
			expectedStatus: "Lost",
			isReady:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status := mapPVCPhaseToStatus(tt.phase, tt.conditions)
			assert.Equal(t, tt.expectedStatus, status)

			ready := isPVCReady(tt.phase, tt.conditions)
			assert.Equal(t, tt.isReady, ready)
		})
	}
}

func TestGetPVCsByLabels(t *testing.T) {
	// Create test PVCs
	pvcs := []runtime.Object{
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "app-data-pvc",
				Namespace: "default",
				Labels: map[string]string{
					"app":                          "web-server",
					"component":                    "data",
					"app.kubernetes.io/managed-by": "unbind",
				},
			},
		},
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "app-logs-pvc",
				Namespace: "default",
				Labels: map[string]string{
					"app":                          "web-server",
					"component":                    "logs",
					"app.kubernetes.io/managed-by": "unbind",
				},
			},
		},
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "other-pvc",
				Namespace: "default",
				Labels: map[string]string{
					"app": "other-app",
				},
			},
		},
	}

	client := fake.NewSimpleClientset(pvcs...)

	// Test filtering by app label
	pvcList, err := client.CoreV1().PersistentVolumeClaims("default").List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)

	webServerPVCs := filterPVCsByLabel(pvcList.Items, "app", "web-server")
	assert.Len(t, webServerPVCs, 2)

	// Test filtering by managed label
	managedPVCs := filterPVCsByLabel(pvcList.Items, "app.kubernetes.io/managed-by", "unbind")
	assert.Len(t, managedPVCs, 2) // Only the managed ones

	// Test filtering by component
	dataPVCs := filterPVCsByLabel(pvcList.Items, "component", "data")
	assert.Len(t, dataPVCs, 1)
	assert.Equal(t, "app-data-pvc", dataPVCs[0].Name)
}

func TestPVCDeletionHandling(t *testing.T) {
	pvcName := "test-pvc"
	namespace := "default"

	// Create a PVC with finalizer
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcName,
			Namespace: namespace,
			Finalizers: []string{
				"kubernetes.io/pvc-protection",
			},
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: resource.MustParse("10Gi"),
				},
			},
		},
	}

	client := fake.NewSimpleClientset(pvc)

	// Verify PVC exists
	_, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), pvcName, metav1.GetOptions{})
	require.NoError(t, err)

	// Test that PVC has protection finalizer
	assert.Contains(t, pvc.Finalizers, "kubernetes.io/pvc-protection")

	// Delete PVC
	err = client.CoreV1().PersistentVolumeClaims(namespace).Delete(context.Background(), pvcName, metav1.DeleteOptions{})
	require.NoError(t, err)

	// In fake client, it's immediately deleted (unlike real cluster)
	_, err = client.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), pvcName, metav1.GetOptions{})
	assert.Error(t, err) // Should be NotFound
}

func TestPVCResizeValidation(t *testing.T) {
	tests := []struct {
		name        string
		currentSize string
		newSize     string
		canResize   bool
		expectError bool
	}{
		{
			name:        "Valid resize increase",
			currentSize: "10Gi",
			newSize:     "20Gi",
			canResize:   true,
			expectError: false,
		},
		{
			name:        "Invalid resize decrease",
			currentSize: "20Gi",
			newSize:     "10Gi",
			canResize:   true,
			expectError: true,
		},
		{
			name:        "Resize not supported",
			currentSize: "10Gi",
			newSize:     "20Gi",
			canResize:   false,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			currentQuantity := resource.MustParse(tt.currentSize)
			newQuantity := resource.MustParse(tt.newSize)

			err := validatePVCResize(currentQuantity, newQuantity, tt.canResize)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPVCNamingValidation(t *testing.T) {
	tests := []struct {
		name    string
		pvcName string
		isValid bool
	}{
		{
			name:    "Valid DNS-1123 name",
			pvcName: "my-app-data",
			isValid: true,
		},
		{
			name:    "Invalid uppercase",
			pvcName: "My-App-Data",
			isValid: false,
		},
		{
			name:    "Too long name",
			pvcName: strings.Repeat("a", 254), // Max is 253
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := isValidPVCName(tt.pvcName)
			assert.Equal(t, tt.isValid, isValid)
		})
	}
}

// Helper functions for testing

func validatePVCCapacity(capacity, minSize, maxSize resource.Quantity) bool {
	return capacity.Cmp(minSize) >= 0 && capacity.Cmp(maxSize) <= 0
}

func convertToGB(quantity resource.Quantity) float64 {
	return float64(quantity.Value()) / (1000 * 1000 * 1000) // Convert to GB (not GiB)
}

func validateAccessModes(accessModes []corev1.PersistentVolumeAccessMode) bool {
	return len(accessModes) > 0
}

func mapPVCPhaseToStatus(phase corev1.PersistentVolumeClaimPhase, conditions []corev1.PersistentVolumeClaimCondition) string {
	switch phase {
	case corev1.ClaimBound:
		return "Bound"
	case corev1.ClaimPending:
		return "Pending"
	case corev1.ClaimLost:
		return "Lost"
	default:
		return "Unknown"
	}
}

func isPVCReady(phase corev1.PersistentVolumeClaimPhase, conditions []corev1.PersistentVolumeClaimCondition) bool {
	return phase == corev1.ClaimBound
}

func filterPVCsByLabel(pvcs []corev1.PersistentVolumeClaim, labelKey, labelValue string) []corev1.PersistentVolumeClaim {
	var filtered []corev1.PersistentVolumeClaim

	for _, pvc := range pvcs {
		if value, exists := pvc.Labels[labelKey]; exists && value == labelValue {
			filtered = append(filtered, pvc)
		}
	}

	return filtered
}

func validatePVCResize(currentSize, newSize resource.Quantity, canResize bool) error {
	if !canResize {
		return fmt.Errorf("volume expansion is not supported for this storage class")
	}

	if newSize.Cmp(currentSize) < 0 {
		return fmt.Errorf("cannot shrink volume from %s to %s", currentSize.String(), newSize.String())
	}

	return nil
}

func isValidPVCName(name string) bool {
	// Basic validation - DNS-1123 subdomain
	if len(name) > 253 || len(name) == 0 {
		return false
	}

	// Check for valid characters (lowercase letters, numbers, hyphens)
	for _, r := range name {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-') {
			return false
		}
	}

	// Cannot start or end with hyphen
	if name[0] == '-' || name[len(name)-1] == '-' {
		return false
	}

	return true
}
