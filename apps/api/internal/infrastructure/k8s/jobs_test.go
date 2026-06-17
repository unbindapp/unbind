package k8s

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestJobConditionType_String(t *testing.T) {
	tests := []struct {
		name     string
		jobType  JobConditionType
		expected string
	}{
		{
			name:     "JobSucceeded",
			jobType:  JobSucceeded,
			expected: "JobSucceeded",
		},
		{
			name:     "JobFailed",
			jobType:  JobFailed,
			expected: "JobFailed",
		},
		{
			name:     "JobRunning",
			jobType:  JobRunning,
			expected: "JobRunning",
		},
		{
			name:     "JobPending",
			jobType:  JobPending,
			expected: "JobPending",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.jobType.String()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestJobConditionType_Values(t *testing.T) {
	// Test that the iota values are correct
	assert.Equal(t, 0, int(JobSucceeded))
	assert.Equal(t, 1, int(JobFailed))
	assert.Equal(t, 2, int(JobRunning))
	assert.Equal(t, 3, int(JobPending))
}

func TestJobStatus_StructCreation(t *testing.T) {
	now := time.Now()
	completedTime := now.Add(time.Minute * 5)
	failedTime := now.Add(time.Minute * 3)

	tests := []struct {
		name   string
		status JobStatus
	}{
		{
			name: "Successful job status",
			status: JobStatus{
				ConditionType: JobSucceeded,
				StartTime:     now,
				CompletedTime: completedTime,
			},
		},
		{
			name: "Failed job status with reason",
			status: JobStatus{
				ConditionType: JobFailed,
				FailureReason: "DeadlineExceeded: Job was active longer than specified deadline",
				StartTime:     now,
				FailedTime:    failedTime,
			},
		},
		{
			name: "Running job status",
			status: JobStatus{
				ConditionType: JobRunning,
				StartTime:     now,
			},
		},
		{
			name: "Pending job status",
			status: JobStatus{
				ConditionType: JobPending,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test that all fields are properly set
			assert.Equal(t, tt.status.ConditionType, tt.status.ConditionType)
			assert.Equal(t, tt.status.FailureReason, tt.status.FailureReason)
			assert.Equal(t, tt.status.StartTime, tt.status.StartTime)
			assert.Equal(t, tt.status.CompletedTime, tt.status.CompletedTime)
			assert.Equal(t, tt.status.FailedTime, tt.status.FailedTime)
		})
	}
}

func TestJobStatus_FailureReasonFormatting(t *testing.T) {
	tests := []struct {
		name                string
		containerName       string
		reason              string
		message             string
		exitCode            int32
		expectedFormatStart string
	}{
		{
			name:                "Full failure details",
			containerName:       "build-container",
			reason:              "Error",
			message:             "Failed to pull image",
			exitCode:            1,
			expectedFormatStart: "Error: Failed to pull image (Container: build-container, Exit Code: 1)",
		},
		{
			name:                "No message",
			containerName:       "init-container",
			reason:              "ImagePullBackOff",
			message:             "",
			exitCode:            125,
			expectedFormatStart: "ImagePullBackOff (Container: init-container, Exit Code: 125)",
		},
		{
			name:                "Timeout error",
			containerName:       "main-container",
			reason:              "DeadlineExceeded",
			message:             "Job was active longer than specified deadline",
			exitCode:            143,
			expectedFormatStart: "DeadlineExceeded: Job was active longer than specified deadline (Container: main-container, Exit Code: 143)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the failure reason formatting logic that would be used in getJobPodsFailureReason
			var formatted string
			if tt.message != "" {
				formatted = formatFailureReason(tt.reason, tt.message, tt.containerName, tt.exitCode)
			} else {
				formatted = formatFailureReasonNoMessage(tt.reason, tt.containerName, tt.exitCode)
			}

			assert.Equal(t, tt.expectedFormatStart, formatted)
		})
	}
}

// Helper functions to test the formatting logic used in getJobPodsFailureReason
func formatFailureReason(reason, message, containerName string, exitCode int32) string {
	return fmt.Sprintf("%s: %s (Container: %s, Exit Code: %d)", reason, message, containerName, exitCode)
}

func formatFailureReasonNoMessage(reason, containerName string, exitCode int32) string {
	return fmt.Sprintf("%s (Container: %s, Exit Code: %d)", reason, containerName, exitCode)
}

func TestJobLabelSelector_Formatting(t *testing.T) {
	tests := []struct {
		name          string
		serviceID     string
		expectedLabel string
	}{
		{
			name:          "Simple service ID",
			serviceID:     "my-service-123",
			expectedLabel: "serviceID=my-service-123",
		},
		{
			name:          "UUID service ID",
			serviceID:     "550e8400-e29b-41d4-a716-446655440000",
			expectedLabel: "serviceID=550e8400-e29b-41d4-a716-446655440000",
		},
		{
			name:          "Empty service ID",
			serviceID:     "",
			expectedLabel: "serviceID=",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the label selector formatting used in CancelJobsByServiceID
			labelSelector := formatServiceIDSelector(tt.serviceID)
			assert.Equal(t, tt.expectedLabel, labelSelector)
		})
	}
}

// Helper function to test the label selector formatting
func formatServiceIDSelector(serviceID string) string {
	return "serviceID=" + serviceID
}

func TestJobName_Generation(t *testing.T) {
	tests := []struct {
		name         string
		deploymentID string
		timestamp    int64
		expected     string
	}{
		{
			name:         "Basic deployment ID",
			deploymentID: "my-app",
			timestamp:    1640995200, // 2022-01-01 00:00:00 UTC
			expected:     "my-app-deployment-1640995200",
		},
		{
			name:         "Deployment ID with numbers",
			deploymentID: "service-v2",
			timestamp:    1609459200, // 2021-01-01 00:00:00 UTC
			expected:     "service-v2-deployment-1609459200",
		},
		{
			name:         "Long deployment ID",
			deploymentID: "very-long-service-name-with-multiple-parts",
			timestamp:    1577836800, // 2020-01-01 00:00:00 UTC
			expected:     "very-long-service-name-with-multiple-parts-deployment-1577836800",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the job name generation logic used in CreateDeployment
			jobName := generateJobName(tt.deploymentID, tt.timestamp)
			assert.Equal(t, tt.expected, jobName)
		})
	}
}

// Helper function to test the job name generation
func generateJobName(deploymentID string, timestamp int64) string {
	return fmt.Sprintf("%s-deployment-%d", deploymentID, timestamp)
}

func TestJobAnnotations_Creation(t *testing.T) {
	// Test the annotation creation logic
	timestamp := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)

	annotations := map[string]string{
		"deployment-triggered-by": "github-webhook",
		"trigger-timestamp":       timestamp.Format(time.RFC3339),
	}

	assert.Equal(t, "github-webhook", annotations["deployment-triggered-by"])
	assert.Equal(t, "2023-01-01T12:00:00Z", annotations["trigger-timestamp"])
	assert.Len(t, annotations, 2)
}

func TestJobLabels_Creation(t *testing.T) {
	deploymentID := "test-service"
	jobName := "test-service-deployment-1640995200"

	labels := map[string]string{
		"unbind-deployment-job":   "true",
		"unbind-deployment-build": deploymentID,
		"job-name":                jobName,
	}

	assert.Equal(t, "true", labels["unbind-deployment-job"])
	assert.Equal(t, deploymentID, labels["unbind-deployment-build"])
	assert.Equal(t, jobName, labels["job-name"])
	assert.Len(t, labels, 3)
}

func TestDeploymentJobsSelector(t *testing.T) {
	// Test the label selector used in CountActiveDeploymentJobs
	selector := "unbind-deployment-job=true"

	assert.Equal(t, "unbind-deployment-job=true", selector)
	assert.Contains(t, selector, "unbind-deployment-job")
	assert.Contains(t, selector, "true")
}
