package models

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func testDeployment(status schema.DeploymentStatus, createdAt time.Time) *ent.Deployment {
	return &ent.Deployment{ID: uuid.New(), Status: status, CreatedAt: createdAt}
}

func TestTransformServiceEntityDeployments(t *testing.T) {
	now := time.Now()

	// A redeploy made while a build ran, which the build replaced when it went live
	build := testDeployment(schema.DeploymentStatusBuildSucceeded, now)
	superseded := testDeployment(schema.DeploymentStatusBuildSucceeded, now.Add(10*time.Second))

	running := testDeployment(schema.DeploymentStatusBuildRunning, now.Add(time.Minute))
	failed := testDeployment(schema.DeploymentStatusBuildFailed, now.Add(time.Minute))
	removed := testDeployment(schema.DeploymentStatusRemoved, now)
	older := testDeployment(schema.DeploymentStatusBuildSucceeded, now.Add(-time.Minute))

	tests := []struct {
		name               string
		current            *ent.Deployment
		deployments        []*ent.Deployment
		wantLast           *ent.Deployment
		wantLastSuccessful *ent.Deployment
	}{
		{"superseded redeploy gives way to the current deployment", build, []*ent.Deployment{superseded}, build, build},
		{"current deployment is the newest", build, []*ent.Deployment{build}, build, build},
		{"build in progress stays on top", build, []*ent.Deployment{running, build}, running, build},
		{"failed build stays on top", build, []*ent.Deployment{failed, build}, failed, build},
		{"removed current deployment", removed, []*ent.Deployment{removed}, removed, nil},
		{"removed current deployment with an older success", removed, []*ent.Deployment{removed, older}, removed, older},
		{"no current deployment", nil, []*ent.Deployment{running}, running, nil},
		{"no deployments", nil, nil, nil, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := TransformServiceEntity(&ent.Service{Edges: ent.ServiceEdges{
				CurrentDeployment: tt.current,
				Deployments:       tt.deployments,
			}})

			assertDeploymentID(t, tt.wantLast, response.LastDeployment, "last deployment")
			assertDeploymentID(t, tt.wantLastSuccessful, response.LastSuccessfulDeployment, "last successful deployment")
		})
	}
}

func assertDeploymentID(t *testing.T, want *ent.Deployment, got *DeploymentResponse, field string) {
	t.Helper()
	if want == nil {
		assert.Nil(t, got, field)
		return
	}
	if assert.NotNil(t, got, field) {
		assert.Equal(t, want.ID, got.ID, field)
	}
}
