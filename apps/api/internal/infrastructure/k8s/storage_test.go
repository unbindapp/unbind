package k8s

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetStorageClasses(t *testing.T) {
	// Create test storage classes
	storageClasses := []runtime.Object{
		&storagev1.StorageClass{
			ObjectMeta: metav1.ObjectMeta{
				Name: "fast-ssd",
				Annotations: map[string]string{
					"storageclass.kubernetes.io/is-default-class": "false",
				},
			},
			Provisioner: "kubernetes.io/aws-ebs",
			Parameters: map[string]string{
				"type": "gp3",
				"iops": "3000",
			},
		},
		&storagev1.StorageClass{
			ObjectMeta: metav1.ObjectMeta{
				Name: "standard",
				Annotations: map[string]string{
					"storageclass.kubernetes.io/is-default-class": "true",
				},
			},
			Provisioner: "kubernetes.io/aws-ebs",
			Parameters: map[string]string{
				"type": "gp2",
			},
		},
		&storagev1.StorageClass{
			ObjectMeta: metav1.ObjectMeta{
				Name: "slow-hdd",
			},
			Provisioner: "kubernetes.io/aws-ebs",
			Parameters: map[string]string{
				"type": "sc1",
			},
		},
	}

	client := fake.NewSimpleClientset(storageClasses...)

	// List all storage classes
	scList, err := client.StorageV1().StorageClasses().List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	assert.Len(t, scList.Items, 3)

	// Find default storage class
	defaultSC := findDefaultStorageClass(scList.Items)
	require.NotNil(t, defaultSC)
	assert.Equal(t, "standard", defaultSC.Name)

	// Find fast storage class
	fastSC := findStorageClassByType(scList.Items, "fast")
	require.NotNil(t, fastSC)
	assert.Equal(t, "fast-ssd", fastSC.Name)
}

func TestCreatePersistentVolume(t *testing.T) {
	tests := []struct {
		name         string
		pvName       string
		storageSize  string
		storageClass string
		expectedSize resource.Quantity
		expectError  bool
	}{
		{
			name:         "Valid PV with 10Gi",
			pvName:       "test-pv-10gi",
			storageSize:  "10Gi",
			storageClass: "fast-ssd",
			expectedSize: resource.MustParse("10Gi"),
			expectError:  false,
		},
		{
			name:         "Valid PV with 1Ti",
			pvName:       "test-pv-1ti",
			storageSize:  "1Ti",
			storageClass: "standard",
			expectedSize: resource.MustParse("1Ti"),
			expectError:  false,
		},
		{
			name:        "Invalid storage size",
			pvName:      "test-pv-invalid",
			storageSize: "invalid-size",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.NewSimpleClientset()

			if !tt.expectError {
				// Create PV using fake client
				pv := &corev1.PersistentVolume{
					ObjectMeta: metav1.ObjectMeta{
						Name: tt.pvName,
						Labels: map[string]string{
							"storage.unbind.app/class": tt.storageClass,
						},
					},
					Spec: corev1.PersistentVolumeSpec{
						Capacity: corev1.ResourceList{
							corev1.ResourceStorage: tt.expectedSize,
						},
						AccessModes: []corev1.PersistentVolumeAccessMode{
							corev1.ReadWriteOnce,
						},
						StorageClassName: tt.storageClass,
					},
				}

				_, err := client.CoreV1().PersistentVolumes().Create(context.Background(), pv, metav1.CreateOptions{})
				require.NoError(t, err)

				// Verify PV was created correctly
				createdPV, err := client.CoreV1().PersistentVolumes().Get(context.Background(), tt.pvName, metav1.GetOptions{})
				require.NoError(t, err)

				assert.Equal(t, tt.pvName, createdPV.Name)
				assert.Equal(t, tt.storageClass, createdPV.Spec.StorageClassName)
				assert.Equal(t, tt.expectedSize, createdPV.Spec.Capacity[corev1.ResourceStorage])
			} else {
				// Test parsing invalid storage size
				_, err := resource.ParseQuantity(tt.storageSize)
				assert.Error(t, err)
			}
		})
	}
}

func TestStorageCapacityCalculation(t *testing.T) {
	tests := []struct {
		name          string
		requestedSize string
		expectedBytes int64
		expectedGiB   float64
	}{
		{
			name:          "1 GiB",
			requestedSize: "1Gi",
			expectedBytes: 1073741824, // 1024^3
			expectedGiB:   1.0,
		},
		{
			name:          "10 GiB",
			requestedSize: "10Gi",
			expectedBytes: 10737418240, // 10 * 1024^3
			expectedGiB:   10.0,
		},
		{
			name:          "1 TiB",
			requestedSize: "1Ti",
			expectedBytes: 1099511627776, // 1024^4
			expectedGiB:   1024.0,
		},
		{
			name:          "500 MiB",
			requestedSize: "500Mi",
			expectedBytes: 524288000, // 500 * 1024^2
			expectedGiB:   0.48828125,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			quantity := resource.MustParse(tt.requestedSize)

			// Test bytes calculation
			bytes := quantity.Value()
			assert.Equal(t, tt.expectedBytes, bytes)

			// Test GiB conversion
			gib := convertBytesToGiB(bytes)
			assert.InDelta(t, tt.expectedGiB, gib, 0.001)
		})
	}
}

func TestStorageClassProvisioners(t *testing.T) {
	tests := []struct {
		name             string
		provisioner      string
		expectedProvider string
		isSupported      bool
	}{
		{
			name:             "AWS EBS provisioner",
			provisioner:      "kubernetes.io/aws-ebs",
			expectedProvider: "aws",
			isSupported:      true,
		},
		{
			name:             "AWS EBS CSI provisioner",
			provisioner:      "ebs.csi.aws.com",
			expectedProvider: "aws",
			isSupported:      true,
		},
		{
			name:             "GCE PD provisioner",
			provisioner:      "kubernetes.io/gce-pd",
			expectedProvider: "gcp",
			isSupported:      true,
		},
		{
			name:             "Azure Disk provisioner",
			provisioner:      "kubernetes.io/azure-disk",
			expectedProvider: "azure",
			isSupported:      true,
		},
		{
			name:             "Unsupported provisioner",
			provisioner:      "some.custom/provisioner",
			expectedProvider: "unknown",
			isSupported:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := getCloudProviderFromProvisioner(tt.provisioner)
			assert.Equal(t, tt.expectedProvider, provider)

			supported := isSupportedProvisioner(tt.provisioner)
			assert.Equal(t, tt.isSupported, supported)
		})
	}
}

func TestStorageClassParameters(t *testing.T) {
	tests := []struct {
		name              string
		parameters        map[string]string
		expectedType      string
		expectedIOPS      string
		expectedEncrypted bool
	}{
		{
			name: "AWS GP3 with IOPS",
			parameters: map[string]string{
				"type":      "gp3",
				"iops":      "3000",
				"encrypted": "true",
			},
			expectedType:      "gp3",
			expectedIOPS:      "3000",
			expectedEncrypted: true,
		},
		{
			name: "AWS GP2 basic",
			parameters: map[string]string{
				"type": "gp2",
			},
			expectedType:      "gp2",
			expectedIOPS:      "",
			expectedEncrypted: false,
		},
		{
			name: "Azure SSD Premium",
			parameters: map[string]string{
				"skuName":     "Premium_LRS",
				"cachingmode": "ReadOnly",
			},
			expectedType:      "",
			expectedIOPS:      "",
			expectedEncrypted: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			storageType := getStorageTypeFromParameters(tt.parameters)
			assert.Equal(t, tt.expectedType, storageType)

			iops := getIOPSFromParameters(tt.parameters)
			assert.Equal(t, tt.expectedIOPS, iops)

			encrypted := isEncryptedFromParameters(tt.parameters)
			assert.Equal(t, tt.expectedEncrypted, encrypted)
		})
	}
}

func TestVolumeExpansionSupport(t *testing.T) {
	tests := []struct {
		name                     string
		allowVolumeExpansion     *bool
		expectedExpansionSupport bool
	}{
		{
			name:                     "Expansion allowed",
			allowVolumeExpansion:     boolPtr(true),
			expectedExpansionSupport: true,
		},
		{
			name:                     "Expansion not allowed",
			allowVolumeExpansion:     boolPtr(false),
			expectedExpansionSupport: false,
		},
		{
			name:                     "Expansion nil (default false)",
			allowVolumeExpansion:     nil,
			expectedExpansionSupport: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sc := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-sc",
				},
				AllowVolumeExpansion: tt.allowVolumeExpansion,
			}

			supportsExpansion := doesStorageClassSupportExpansion(sc)
			assert.Equal(t, tt.expectedExpansionSupport, supportsExpansion)
		})
	}
}

func TestStorageQuotaCalculation(t *testing.T) {
	tests := []struct {
		name          string
		requests      []string
		expectedTotal string
		expectError   bool
	}{
		{
			name:          "Sum multiple requests",
			requests:      []string{"10Gi", "5Gi", "2Gi"},
			expectedTotal: "17Gi",
			expectError:   false,
		},
		{
			name:          "Mixed units",
			requests:      []string{"1Ti", "512Gi", "1024Mi"},
			expectedTotal: "1537Gi",
			expectError:   false,
		},
		{
			name:        "Invalid quantity",
			requests:    []string{"10Gi", "invalid"},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			total, err := calculateTotalStorageQuota(tt.requests)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				expected := resource.MustParse(tt.expectedTotal)
				assert.True(t, total.Equal(expected), "Expected %s, got %s", tt.expectedTotal, total.String())
			}
		})
	}
}

// Helper functions for testing

func findDefaultStorageClass(storageClasses []storagev1.StorageClass) *storagev1.StorageClass {
	for _, sc := range storageClasses {
		if sc.Annotations["storageclass.kubernetes.io/is-default-class"] == "true" {
			return &sc
		}
	}
	return nil
}

func findStorageClassByType(storageClasses []storagev1.StorageClass, typeHint string) *storagev1.StorageClass {
	for _, sc := range storageClasses {
		if strings.Contains(strings.ToLower(sc.Name), typeHint) {
			return &sc
		}
	}
	return nil
}

func convertBytesToGiB(bytes int64) float64 {
	return float64(bytes) / (1024 * 1024 * 1024)
}

func getCloudProviderFromProvisioner(provisioner string) string {
	switch {
	case strings.Contains(provisioner, "aws") || strings.Contains(provisioner, "ebs"):
		return "aws"
	case strings.Contains(provisioner, "gce") || strings.Contains(provisioner, "gcp"):
		return "gcp"
	case strings.Contains(provisioner, "azure"):
		return "azure"
	default:
		return "unknown"
	}
}

func isSupportedProvisioner(provisioner string) bool {
	supportedProvisioners := []string{
		"kubernetes.io/aws-ebs",
		"ebs.csi.aws.com",
		"kubernetes.io/gce-pd",
		"kubernetes.io/azure-disk",
	}

	for _, supported := range supportedProvisioners {
		if provisioner == supported {
			return true
		}
	}
	return false
}

func getStorageTypeFromParameters(params map[string]string) string {
	return params["type"]
}

func getIOPSFromParameters(params map[string]string) string {
	return params["iops"]
}

func isEncryptedFromParameters(params map[string]string) bool {
	return params["encrypted"] == "true"
}

func doesStorageClassSupportExpansion(sc *storagev1.StorageClass) bool {
	return sc.AllowVolumeExpansion != nil && *sc.AllowVolumeExpansion
}

func calculateTotalStorageQuota(requests []string) (resource.Quantity, error) {
	total := resource.Quantity{}

	for _, req := range requests {
		quantity, err := resource.ParseQuantity(req)
		if err != nil {
			return resource.Quantity{}, err
		}
		total.Add(quantity)
	}

	return total, nil
}

func boolPtr(b bool) *bool {
	return &b
}
