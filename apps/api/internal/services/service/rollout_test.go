package service_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
)

func TestResolveChangeAction(t *testing.T) {
	tests := []struct {
		name   string
		active bool
		needs  service_repo.NeedsDeploymentResponse
		touch  serviceTouch
		want   models.ChangeAction
	}{
		{"inactive service never rolls out", false, service_repo.NeedsBuildAndDeployment, serviceTouch{config: true, variables: true}, models.ChangeActionNone},
		{"build settings win", true, service_repo.NeedsBuildAndDeployment, serviceTouch{config: true, variables: true}, models.ChangeActionBuild},
		{"config change redeploys", true, service_repo.NeedsDeployment, serviceTouch{config: true}, models.ChangeActionRedeploy},
		{"config redeploy absorbs a restart", true, service_repo.NeedsDeployment, serviceTouch{config: true, variables: true}, models.ChangeActionRedeploy},
		{"rendered variable redeploys", true, service_repo.NoDeploymentNeeded, serviceTouch{variables: true, rendered: true}, models.ChangeActionRedeploy},
		{"referenced variable redeploys", true, service_repo.NoDeploymentNeeded, serviceTouch{references: []string{"KEY"}}, models.ChangeActionRedeploy},
		{"literal variable restarts", true, service_repo.NoDeploymentNeeded, serviceTouch{variables: true}, models.ChangeActionRestart},
		{"no-op config change does nothing", true, service_repo.NoDeploymentNeeded, serviceTouch{config: true}, models.ChangeActionNone},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, resolveChangeAction(tt.active, tt.needs, &tt.touch))
		})
	}
}

func TestEstimateConfigChange(t *testing.T) {
	config := &ent.ServiceConfig{
		Builder:                     schema.ServiceBuilderRailpack,
		GitBranch:                   utils.ToPtr("main"),
		RailpackBuilderBuildCommand: utils.ToPtr("npm run build"),
		Replicas:                    2,
		Image:                       "nginx:1.25",
		RunCommand:                  utils.ToPtr("npm start"),
	}

	tests := []struct {
		name  string
		input models.UpdateServiceInput
		want  service_repo.NeedsDeploymentResponse
	}{
		{"nothing", models.UpdateServiceInput{}, service_repo.NoDeploymentNeeded},
		{"same values", models.UpdateServiceInput{Replicas: utils.ToPtr[int32](2), GitBranch: utils.ToPtr("main"), RunCommand: utils.ToPtr("npm start")}, service_repo.NoDeploymentNeeded},
		{"name only", models.UpdateServiceInput{Name: utils.ToPtr("renamed")}, service_repo.NoDeploymentNeeded},
		{"builder", models.UpdateServiceInput{Builder: utils.ToPtr(schema.ServiceBuilderDocker)}, service_repo.NeedsBuildAndDeployment},
		{"branch", models.UpdateServiceInput{GitBranch: utils.ToPtr("develop")}, service_repo.NeedsBuildAndDeployment},
		{"build command", models.UpdateServiceInput{RailpackBuilderBuildCommand: utils.ToPtr("pnpm build")}, service_repo.NeedsBuildAndDeployment},
		{"dockerfile path from unset", models.UpdateServiceInput{DockerBuilderDockerfilePath: utils.ToPtr("app/Dockerfile")}, service_repo.NeedsBuildAndDeployment},
		{"dockerfile path reset while unset", models.UpdateServiceInput{DockerBuilderDockerfilePath: utils.ToPtr("")}, service_repo.NoDeploymentNeeded},
		{"replicas", models.UpdateServiceInput{Replicas: utils.ToPtr[int32](3)}, service_repo.NeedsDeployment},
		{"image", models.UpdateServiceInput{Image: utils.ToPtr("nginx:1.27")}, service_repo.NeedsDeployment},
		{"run command", models.UpdateServiceInput{RunCommand: utils.ToPtr("node server.js")}, service_repo.NeedsDeployment},
		{"hosts", models.UpdateServiceInput{UpsertHosts: []schema.HostSpec{{Host: "example.com"}}}, service_repo.NeedsDeployment},
		{"ports", models.UpdateServiceInput{RemovePorts: []schema.PortSpec{{Port: 3000}}}, service_repo.NeedsDeployment},
		{"resources", models.UpdateServiceInput{Resources: &schema.Resources{}}, service_repo.NeedsDeployment},
		{"health check", models.UpdateServiceInput{HealthCheck: &schema.HealthCheck{}}, service_repo.NeedsDeployment},
		{"build and deploy changes prefer build", models.UpdateServiceInput{Replicas: utils.ToPtr[int32](3), GitBranch: utils.ToPtr("develop")}, service_repo.NeedsBuildAndDeployment},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, estimateConfigChange(config, &tt.input))
		})
	}
}

func TestServiceTouchReasons(t *testing.T) {
	assert.Equal(t, []models.ChangeReason{}, (&serviceTouch{}).reasons())
	assert.Equal(t, []models.ChangeReason{models.ChangeReasonConfig}, (&serviceTouch{config: true}).reasons())
	assert.Equal(t,
		[]models.ChangeReason{models.ChangeReasonConfig, models.ChangeReasonVariables, models.ChangeReasonReference},
		(&serviceTouch{config: true, variables: true, references: []string{"KEY"}}).reasons(),
	)
}

func TestProjectConfig(t *testing.T) {
	config := &ent.ServiceConfig{
		Replicas: 2,
		Ports:    []schema.PortSpec{{Port: 3000}, {Port: 4000}},
		Hosts:    []schema.HostSpec{{Host: "a.com", TargetPort: utils.ToPtr[int32](3000)}},
	}

	projected := projectConfig(config, &models.UpdateServiceInput{
		RemovePorts: []schema.PortSpec{{Port: 3000}},
		AddPorts:    []schema.PortSpec{{Port: 5000}},
		UpsertHosts: []schema.HostSpec{{Host: "b.com", PrevHost: utils.ToPtr("a.com")}},
	})
	assert.Equal(t, []schema.PortSpec{{Port: 4000}, {Port: 5000}}, projected.Ports)
	assert.Equal(t, []schema.HostSpec{{Host: "b.com", PrevHost: utils.ToPtr("a.com")}}, projected.Hosts)
	assert.Equal(t, int32(2), projected.Replicas)

	untouched := projectConfig(config, &models.UpdateServiceInput{Replicas: utils.ToPtr[int32](3)})
	assert.Equal(t, config.Ports, untouched.Ports)
	assert.Equal(t, config.Hosts, untouched.Hosts)
	assert.Equal(t, []schema.PortSpec{{Port: 3000}, {Port: 4000}}, config.Ports)
}
