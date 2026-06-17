package prometheus

import (
	"context"
	"fmt"
	"testing"
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	mocks_promapi "github.com/unbindapp/unbind-api/mocks/promapi"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
)

type VolumeQueryTestSuite struct {
	suite.Suite
	client     *PrometheusClient
	mockAPI    *mocks_promapi.PromAPIInterfaceMock
	kubeClient kubernetes.Interface
	ctx        context.Context
	cancel     context.CancelFunc
	testStart  time.Time
	testEnd    time.Time
	testStep   time.Duration
}

func (s *VolumeQueryTestSuite) SetupTest() {
	s.ctx, s.cancel = context.WithTimeout(context.Background(), 5*time.Second)

	s.mockAPI = mocks_promapi.NewPromAPIInterfaceMock(s.T())
	s.client = &PrometheusClient{
		cfg: &config.Config{PrometheusEndpoint: "http://prometheus:9090"},
		api: s.mockAPI,
	}

	// Setup fake Kubernetes client
	s.kubeClient = fake.NewSimpleClientset()

	// Setup test time range
	s.testEnd = time.Now().Truncate(time.Minute)
	s.testStart = s.testEnd.Add(-1 * time.Hour)
	s.testStep = 5 * time.Minute
}

func (s *VolumeQueryTestSuite) TearDownTest() {
	if s.cancel != nil {
		s.cancel()
	}
	s.mockAPI.AssertExpectations(s.T())
}

func (s *VolumeQueryTestSuite) createTestPVC(name, namespace string, capacityGB float64, usedGB *float64) *corev1.PersistentVolumeClaim {
	capacity := resource.MustParse(fmt.Sprintf("%.0fGi", capacityGB))
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: capacity,
				},
			},
		},
		Status: corev1.PersistentVolumeClaimStatus{
			Capacity: corev1.ResourceList{
				corev1.ResourceStorage: capacity,
			},
		},
	}
	return pvc
}

func (s *VolumeQueryTestSuite) createPrometheusUsageVector(pvcName string, usedGB float64) model.Vector {
	return model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"persistentvolumeclaim": model.LabelValue(pvcName),
				"job":                   "kubelet",
			},
			Value: model.SampleValue(usedGB),
		},
	}
}

func (s *VolumeQueryTestSuite) TestGetPVCsVolumeStats_Success() {
	namespace := "test-namespace"
	pvcNames := []string{"test-pvc-1", "test-pvc-2"}

	// Create test PVCs
	pvc1 := s.createTestPVC("test-pvc-1", namespace, 10.0, nil)
	pvc2 := s.createTestPVC("test-pvc-2", namespace, 20.0, nil)

	_, err := s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc1, metav1.CreateOptions{})
	s.NoError(err)
	_, err = s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc2, metav1.CreateOptions{})
	s.NoError(err)

	// Mock Prometheus usage query
	usageVector := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"persistentvolumeclaim": "test-pvc-1",
				"job":                   "kubelet",
			},
			Value: model.SampleValue(5.5),
		},
		&model.Sample{
			Metric: model.Metric{
				"persistentvolumeclaim": "test-pvc-2",
				"job":                   "kubelet",
			},
			Value: model.SampleValue(12.3),
		},
	}

	s.mockAPI.On("Query", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "kubelet_volume_stats_used_bytes")
	}), mock.AnythingOfType("time.Time")).Return(
		usageVector, v1.Warnings{}, nil,
	)

	result, err := s.client.GetPVCsVolumeStats(s.ctx, pvcNames, namespace, s.kubeClient)

	s.NoError(err)
	s.Len(result, 2)

	// Verify results
	s.Equal("test-pvc-1", result[0].PVCName)
	s.Equal(10.0, result[0].CapacityGB)
	s.NotNil(result[0].UsedGB)
	s.Equal(5.5, *result[0].UsedGB)

	s.Equal("test-pvc-2", result[1].PVCName)
	s.Equal(20.0, result[1].CapacityGB)
	s.NotNil(result[1].UsedGB)
	s.Equal(12.3, *result[1].UsedGB)
}

func (s *VolumeQueryTestSuite) TestGetPVCsVolumeStats_EmptyPVCNames() {
	result, err := s.client.GetPVCsVolumeStats(s.ctx, []string{}, "test-namespace", s.kubeClient)

	s.NoError(err)
	s.Empty(result)
}

func (s *VolumeQueryTestSuite) TestGetPVCsVolumeStats_PrometheusError() {
	namespace := "test-namespace"
	pvcNames := []string{"test-pvc-1"}

	// Create test PVC
	pvc1 := s.createTestPVC("test-pvc-1", namespace, 10.0, nil)
	_, err := s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc1, metav1.CreateOptions{})
	s.NoError(err)

	// Mock Prometheus error
	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		nil, v1.Warnings{}, fmt.Errorf("Prometheus connection failed"),
	)

	result, err := s.client.GetPVCsVolumeStats(s.ctx, pvcNames, namespace, s.kubeClient)

	// Should not fail - just return PVC info without usage stats
	s.NoError(err)
	s.Len(result, 1)
	s.Equal("test-pvc-1", result[0].PVCName)
	s.Equal(10.0, result[0].CapacityGB)
	s.Nil(result[0].UsedGB) // No usage data due to Prometheus error
}

func (s *VolumeQueryTestSuite) TestGetPVCsVolumeStats_KubernetesError() {
	namespace := "nonexistent-namespace"
	pvcNames := []string{"test-pvc-1"}

	// Mock Prometheus query (will be called but should handle error gracefully)
	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		model.Vector{}, v1.Warnings{}, nil,
	)

	result, err := s.client.GetPVCsVolumeStats(s.ctx, pvcNames, namespace, s.kubeClient)

	s.NoError(err)  // Function should handle missing PVCs gracefully
	s.Empty(result) // No PVCs found in the namespace
}

func (s *VolumeQueryTestSuite) TestGetPVCsVolumeStats_PartialResults() {
	namespace := "test-namespace"
	pvcNames := []string{"test-pvc-1", "nonexistent-pvc"}

	// Create only one of the requested PVCs
	pvc1 := s.createTestPVC("test-pvc-1", namespace, 10.0, nil)
	_, err := s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc1, metav1.CreateOptions{})
	s.NoError(err)

	// Mock Prometheus usage query
	usageVector := s.createPrometheusUsageVector("test-pvc-1", 5.5)
	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		usageVector, v1.Warnings{}, nil,
	)

	result, err := s.client.GetPVCsVolumeStats(s.ctx, pvcNames, namespace, s.kubeClient)

	s.NoError(err)
	s.Len(result, 1) // Only one PVC exists
	s.Equal("test-pvc-1", result[0].PVCName)
}

func (s *VolumeQueryTestSuite) TestGetPVCsVolumeStats_NoUsageData() {
	namespace := "test-namespace"
	pvcNames := []string{"test-pvc-1"}

	// Create test PVC
	pvc1 := s.createTestPVC("test-pvc-1", namespace, 10.0, nil)
	_, err := s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc1, metav1.CreateOptions{})
	s.NoError(err)

	// Mock empty Prometheus response
	emptyVector := model.Vector{}
	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		emptyVector, v1.Warnings{}, nil,
	)

	result, err := s.client.GetPVCsVolumeStats(s.ctx, pvcNames, namespace, s.kubeClient)

	s.NoError(err)
	s.Len(result, 1)
	s.Equal("test-pvc-1", result[0].PVCName)
	s.Equal(10.0, result[0].CapacityGB)
	s.Nil(result[0].UsedGB) // No usage data available
}

func (s *VolumeQueryTestSuite) TestGetPVCsVolumeStats_CapacityFromRequests() {
	namespace := "test-namespace"
	pvcNames := []string{"test-pvc-1"}

	// Create PVC with capacity only in requests (not in status)
	capacity := resource.MustParse("15Gi")
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-pvc-1",
			Namespace: namespace,
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: capacity,
				},
			},
		},
		Status: corev1.PersistentVolumeClaimStatus{
			// No capacity in status
		},
	}

	_, err := s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc, metav1.CreateOptions{})
	s.NoError(err)

	// Mock empty Prometheus response
	emptyVector := model.Vector{}
	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		emptyVector, v1.Warnings{}, nil,
	)

	result, err := s.client.GetPVCsVolumeStats(s.ctx, pvcNames, namespace, s.kubeClient)

	s.NoError(err)
	s.Len(result, 1)
	s.Equal("test-pvc-1", result[0].PVCName)
	s.Equal(15.0, result[0].CapacityGB) // Should use capacity from requests
}

func (s *VolumeQueryTestSuite) TestGetVolumeStatsWithHistory_Success() {
	namespace := "test-namespace"
	pvcName := "test-pvc-1"

	// Create test PVC
	pvc1 := s.createTestPVC(pvcName, namespace, 10.0, nil)
	_, err := s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc1, metav1.CreateOptions{})
	s.NoError(err)

	// Mock current stats query
	usageVector := s.createPrometheusUsageVector(pvcName, 5.5)
	s.mockAPI.On("Query", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "kubelet_volume_stats_used_bytes") && containsString(query, "last_over_time")
	}), mock.AnythingOfType("time.Time")).Return(
		usageVector, v1.Warnings{}, nil,
	)

	// Create historical data
	samples := make([]model.SamplePair, 5)
	for i := 0; i < 5; i++ {
		timestamp := s.testStart.Add(time.Duration(i) * s.testStep)
		samples[i] = model.SamplePair{
			Timestamp: model.Time(timestamp.Unix() * 1000),
			Value:     model.SampleValue(float64(i+1) * 1.5),
		}
	}

	historyMatrix := model.Matrix{
		&model.SampleStream{
			Metric: model.Metric{
				"persistentvolumeclaim": model.LabelValue(pvcName),
			},
			Values: samples,
		},
	}

	// Mock historical query
	s.mockAPI.On("QueryRange", s.ctx, mock.MatchedBy(func(query string) bool {
		return containsString(query, "kubelet_volume_stats_used_bytes") && containsString(query, pvcName)
	}), mock.AnythingOfType("v1.Range")).Return(
		historyMatrix, v1.Warnings{}, nil,
	)

	result, err := s.client.GetVolumeStatsWithHistory(
		s.ctx,
		pvcName,
		s.testStart,
		s.testEnd,
		s.testStep,
		namespace,
		s.kubeClient,
	)

	s.NoError(err)
	s.NotNil(result)
	s.NotNil(result.Stats)
	s.Equal(pvcName, result.Stats.PVCName)
	s.Equal(10.0, result.Stats.CapacityGB)
	s.NotNil(result.Stats.UsedGB)
	s.Equal(5.5, *result.Stats.UsedGB)
	s.Equal(samples, result.History)
}

func (s *VolumeQueryTestSuite) TestGetVolumeStatsWithHistory_StatsError() {
	namespace := "test-namespace"
	pvcName := "nonexistent-pvc"

	// Mock current stats query (will return empty result)
	emptyVector := model.Vector{}
	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		emptyVector, v1.Warnings{}, nil,
	)

	// Mock historical query
	emptyMatrix := model.Matrix{}
	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("v1.Range")).Return(
		emptyMatrix, v1.Warnings{}, nil,
	)

	result, err := s.client.GetVolumeStatsWithHistory(
		s.ctx,
		pvcName,
		s.testStart,
		s.testEnd,
		s.testStep,
		namespace,
		s.kubeClient,
	)

	s.NoError(err)
	s.NotNil(result)
	s.Nil(result.Stats) // No stats found
	s.Empty(result.History)
}

func (s *VolumeQueryTestSuite) TestGetVolumeStatsWithHistory_HistoryError() {
	namespace := "test-namespace"
	pvcName := "test-pvc-1"

	// Create test PVC
	pvc1 := s.createTestPVC(pvcName, namespace, 10.0, nil)
	_, err := s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc1, metav1.CreateOptions{})
	s.NoError(err)

	// Mock current stats query
	usageVector := s.createPrometheusUsageVector(pvcName, 5.5)
	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		usageVector, v1.Warnings{}, nil,
	)

	// Mock failed historical query
	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("v1.Range")).Return(
		nil, v1.Warnings{}, fmt.Errorf("Historical query failed"),
	)

	result, err := s.client.GetVolumeStatsWithHistory(
		s.ctx,
		pvcName,
		s.testStart,
		s.testEnd,
		s.testStep,
		namespace,
		s.kubeClient,
	)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "failed to query volume history")
}

func (s *VolumeQueryTestSuite) TestGetVolumeStatsWithHistory_EmptyHistory() {
	namespace := "test-namespace"
	pvcName := "test-pvc-1"

	// Create test PVC
	pvc1 := s.createTestPVC(pvcName, namespace, 10.0, nil)
	_, err := s.kubeClient.CoreV1().PersistentVolumeClaims(namespace).Create(s.ctx, pvc1, metav1.CreateOptions{})
	s.NoError(err)

	// Mock current stats query
	usageVector := s.createPrometheusUsageVector(pvcName, 5.5)
	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		usageVector, v1.Warnings{}, nil,
	)

	// Mock empty historical query
	emptyMatrix := model.Matrix{}
	s.mockAPI.On("QueryRange", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("v1.Range")).Return(
		emptyMatrix, v1.Warnings{}, nil,
	)

	result, err := s.client.GetVolumeStatsWithHistory(
		s.ctx,
		pvcName,
		s.testStart,
		s.testEnd,
		s.testStep,
		namespace,
		s.kubeClient,
	)

	s.NoError(err)
	s.NotNil(result)
	s.NotNil(result.Stats)
	s.Empty(result.History)
}

func (s *VolumeQueryTestSuite) TestGetPrometheusUsageStats_UnexpectedResultType() {
	pvcNames := []string{"test-pvc-1"}

	// Mock query returning unexpected result type
	scalar := &model.Scalar{
		Value:     model.SampleValue(42.0),
		Timestamp: model.Time(time.Now().Unix() * 1000),
	}

	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		scalar, v1.Warnings{}, nil,
	)

	result, err := s.client.getPrometheusUsageStats(s.ctx, pvcNames)

	s.Error(err)
	s.Nil(result)
	s.Contains(err.Error(), "unexpected result type")
}

func (s *VolumeQueryTestSuite) TestGetPrometheusUsageStats_FilterTargetPVCs() {
	pvcNames := []string{"target-pvc"}

	// Mock query returning data for multiple PVCs, including non-target ones
	usageVector := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"persistentvolumeclaim": "target-pvc",
				"job":                   "kubelet",
			},
			Value: model.SampleValue(5.5),
		},
		&model.Sample{
			Metric: model.Metric{
				"persistentvolumeclaim": "other-pvc",
				"job":                   "kubelet",
			},
			Value: model.SampleValue(10.0),
		},
	}

	s.mockAPI.On("Query", s.ctx, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(
		usageVector, v1.Warnings{}, nil,
	)

	result, err := s.client.getPrometheusUsageStats(s.ctx, pvcNames)

	s.NoError(err)
	s.NotNil(result)
	s.Len(result, 1)
	s.Contains(result, "target-pvc")
	s.NotContains(result, "other-pvc")
	s.Equal(5.5, *result["target-pvc"])
}

func (s *VolumeQueryTestSuite) TestPVCVolumeStats_Structure() {
	// Test the structure of PVCVolumeStats
	stats := &PVCVolumeStats{
		PVCName:    "test-pvc",
		UsedGB:     utils.ToPtr(5.5),
		CapacityGB: 10.0,
	}

	s.Equal("test-pvc", stats.PVCName)
	s.NotNil(stats.UsedGB)
	s.Equal(5.5, *stats.UsedGB)
	s.Equal(10.0, stats.CapacityGB)
}

func (s *VolumeQueryTestSuite) TestVolumeStatsWithHistory_Structure() {
	// Test the structure of VolumeStatsWithHistory
	samples := []model.SamplePair{
		{Timestamp: model.Time(time.Now().Unix() * 1000), Value: model.SampleValue(1.0)},
	}

	stats := &PVCVolumeStats{
		PVCName:    "test-pvc",
		CapacityGB: 10.0,
	}

	volumeStats := &VolumeStatsWithHistory{
		Stats:   stats,
		History: samples,
	}

	s.Equal(stats, volumeStats.Stats)
	s.Equal(samples, volumeStats.History)
}

func TestVolumeQueryTestSuite(t *testing.T) {
	suite.Run(t, new(VolumeQueryTestSuite))
}
