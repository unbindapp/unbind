package controller

import (
	"testing"

	altinityv1 "github.com/altinity/clickhouse-operator/pkg/apis/clickhouse.altinity.com/v1"
	mocov1beta2 "github.com/cybozu-go/moco/api/v1beta2"
	helmv2 "github.com/fluxcd/helm-controller/api/v2"
	fluxmeta "github.com/fluxcd/pkg/apis/meta"
	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	postgresv1 "github.com/zalando/postgres-operator/pkg/apis/acid.zalan.do/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestHelmReleaseStatusCondition(t *testing.T) {
	release := func(conditions ...metav1.Condition) *helmv2.HelmRelease {
		return &helmv2.HelmRelease{Status: helmv2.HelmReleaseStatus{Conditions: conditions}}
	}

	tests := []struct {
		name           string
		release        *helmv2.HelmRelease
		expectedStatus metav1.ConditionStatus
		expectedReason string
	}{
		{
			name:           "no conditions is progressing",
			release:        release(),
			expectedStatus: metav1.ConditionFalse,
			expectedReason: v1.DatabaseReasonProgressing,
		},
		{
			name:           "ready true is ready",
			release:        release(metav1.Condition{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionTrue}),
			expectedStatus: metav1.ConditionTrue,
			expectedReason: v1.DatabaseReasonReady,
		},
		{
			name: "stalled is failed",
			release: release(
				metav1.Condition{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionFalse, Reason: "Progressing"},
				metav1.Condition{Type: fluxmeta.StalledCondition, Status: metav1.ConditionTrue, Message: "retries exhausted"},
			),
			expectedStatus: metav1.ConditionFalse,
			expectedReason: v1.DatabaseReasonFailed,
		},
		{
			name:           "upgrade failed is failed",
			release:        release(metav1.Condition{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionFalse, Reason: helmv2.UpgradeFailedReason, Message: "upgrade failed"}),
			expectedStatus: metav1.ConditionFalse,
			expectedReason: v1.DatabaseReasonFailed,
		},
		{
			name:           "ready false mid-upgrade is progressing",
			release:        release(metav1.Condition{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionFalse, Reason: "Progressing"}),
			expectedStatus: metav1.ConditionFalse,
			expectedReason: v1.DatabaseReasonProgressing,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := helmReleaseStatusCondition(tt.release)
			assert.Equal(t, v1.ConditionTypeDatabaseReady, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status)
			assert.Equal(t, tt.expectedReason, condition.Reason)
		})
	}
}

func TestPostgresStatusCondition(t *testing.T) {
	postgres := func(status string) *postgresv1.Postgresql {
		return &postgresv1.Postgresql{Status: postgresv1.PostgresStatus{PostgresClusterStatus: status}}
	}

	tests := []struct {
		status         string
		expectedReason string
	}{
		{postgresv1.ClusterStatusRunning, v1.DatabaseReasonReady},
		{postgresv1.ClusterStatusCreating, v1.DatabaseReasonProgressing},
		{postgresv1.ClusterStatusUpdating, v1.DatabaseReasonProgressing},
		{postgresv1.ClusterStatusUnknown, v1.DatabaseReasonProgressing},
		{postgresv1.ClusterStatusAddFailed, v1.DatabaseReasonFailed},
		{postgresv1.ClusterStatusUpdateFailed, v1.DatabaseReasonFailed},
		{postgresv1.ClusterStatusSyncFailed, v1.DatabaseReasonFailed},
		{postgresv1.ClusterStatusInvalid, v1.DatabaseReasonFailed},
	}

	for _, tt := range tests {
		t.Run("status "+tt.status, func(t *testing.T) {
			assert.Equal(t, tt.expectedReason, postgresStatusCondition(postgres(tt.status)).Reason)
		})
	}
}

func TestMysqlStatusCondition(t *testing.T) {
	cluster := func(conditions ...metav1.Condition) *mocov1beta2.MySQLCluster {
		return &mocov1beta2.MySQLCluster{Status: mocov1beta2.MySQLClusterStatus{Conditions: conditions}}
	}

	tests := []struct {
		name           string
		cluster        *mocov1beta2.MySQLCluster
		expectedReason string
	}{
		{
			name:           "no conditions is progressing",
			cluster:        cluster(),
			expectedReason: v1.DatabaseReasonProgressing,
		},
		{
			name:           "healthy is ready",
			cluster:        cluster(metav1.Condition{Type: mocov1beta2.ConditionHealthy, Status: metav1.ConditionTrue}),
			expectedReason: v1.DatabaseReasonReady,
		},
		{
			name: "initialized but unavailable is failed",
			cluster: cluster(
				metav1.Condition{Type: mocov1beta2.ConditionInitialized, Status: metav1.ConditionTrue},
				metav1.Condition{Type: mocov1beta2.ConditionAvailable, Status: metav1.ConditionFalse, Message: "pods down"},
			),
			expectedReason: v1.DatabaseReasonFailed,
		},
		{
			name: "available but not yet healthy is progressing",
			cluster: cluster(
				metav1.Condition{Type: mocov1beta2.ConditionInitialized, Status: metav1.ConditionTrue},
				metav1.Condition{Type: mocov1beta2.ConditionAvailable, Status: metav1.ConditionTrue},
				metav1.Condition{Type: mocov1beta2.ConditionHealthy, Status: metav1.ConditionFalse},
			),
			expectedReason: v1.DatabaseReasonProgressing,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expectedReason, mysqlStatusCondition(tt.cluster).Reason)
		})
	}
}

func TestClickhouseStatusCondition(t *testing.T) {
	installation := func(status *altinityv1.Status) *altinityv1.ClickHouseInstallation {
		return &altinityv1.ClickHouseInstallation{Status: status}
	}

	tests := []struct {
		name           string
		installation   *altinityv1.ClickHouseInstallation
		expectedReason string
	}{
		{
			name:           "nil status is progressing",
			installation:   installation(nil),
			expectedReason: v1.DatabaseReasonProgressing,
		},
		{
			name:           "completed is ready",
			installation:   installation(&altinityv1.Status{Status: altinityv1.StatusCompleted}),
			expectedReason: v1.DatabaseReasonReady,
		},
		{
			name:           "in progress is progressing",
			installation:   installation(&altinityv1.Status{Status: altinityv1.StatusInProgress}),
			expectedReason: v1.DatabaseReasonProgressing,
		},
		{
			name:           "aborted is failed",
			installation:   installation(&altinityv1.Status{Status: altinityv1.StatusAborted, TaskID: "abc"}),
			expectedReason: v1.DatabaseReasonFailed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expectedReason, clickhouseStatusCondition(tt.installation).Reason)
		})
	}
}
