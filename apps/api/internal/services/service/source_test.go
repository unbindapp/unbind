package service_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

func TestValidateSourceUpdate(t *testing.T) {
	repository := func() *models.UpdateServiceInput {
		return &models.UpdateServiceInput{GitHubInstallationID: new(int64(1)), RepositoryOwner: new("yekta"), RepositoryName: new("bio")}
	}

	tests := []struct {
		name        string
		serviceType schema.ServiceType
		input       *models.UpdateServiceInput
		wantErr     string
	}{
		{name: "repository on git service", serviceType: schema.ServiceTypeGithub, input: repository()},
		{name: "repository with branch", serviceType: schema.ServiceTypeGithub, input: &models.UpdateServiceInput{GitHubInstallationID: new(int64(1)), RepositoryOwner: new("yekta"), RepositoryName: new("bio"), GitBranch: new("main")}},
		{name: "partial repository", serviceType: schema.ServiceTypeGithub, input: &models.UpdateServiceInput{RepositoryName: new("bio")}, wantErr: "provided together"},
		{name: "empty repository name", serviceType: schema.ServiceTypeGithub, input: &models.UpdateServiceInput{GitHubInstallationID: new(int64(1)), RepositoryOwner: new("yekta"), RepositoryName: new("")}, wantErr: "cannot be empty"},
		{name: "repository on image service", serviceType: schema.ServiceTypeDockerimage, input: repository(), wantErr: "Only a git service can change its repository"},
		{name: "branch on image service", serviceType: schema.ServiceTypeDockerimage, input: &models.UpdateServiceInput{GitBranch: new("main")}, wantErr: "builds from a branch"},
		{name: "tag on database", serviceType: schema.ServiceTypeDatabase, input: &models.UpdateServiceInput{GitTag: new("v*")}, wantErr: "builds from a tag"},
		{name: "watch paths on database", serviceType: schema.ServiceTypeDatabase, input: &models.UpdateServiceInput{WatchPaths: &[]string{"src/**"}}, wantErr: "Watch paths only apply"},
		{name: "image on image service", serviceType: schema.ServiceTypeDockerimage, input: &models.UpdateServiceInput{Image: new("nginx:1.29")}},
		{name: "image on git service", serviceType: schema.ServiceTypeGithub, input: &models.UpdateServiceInput{Image: new("nginx:1.29")}, wantErr: "Only an image service"},
		{name: "empty image", serviceType: schema.ServiceTypeDockerimage, input: &models.UpdateServiceInput{Image: new("")}, wantErr: "Image cannot be empty"},
		{name: "unrelated fields on database", serviceType: schema.ServiceTypeDatabase, input: &models.UpdateServiceInput{Replicas: new(int32(2))}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateSourceUpdate(tt.serviceType, tt.input)
			if tt.wantErr == "" {
				assert.NoError(t, err)
				return
			}
			assert.ErrorContains(t, err, tt.wantErr)
		})
	}
}

func TestSameRepository(t *testing.T) {
	service := &ent.Service{GithubInstallationID: new(int64(7)), GitRepositoryOwner: new("Yekta"), GitRepository: new("bio")}
	input := func(installation int64, owner, name string) *models.UpdateServiceInput {
		return &models.UpdateServiceInput{GitHubInstallationID: new(installation), RepositoryOwner: new(owner), RepositoryName: new(name)}
	}

	assert.True(t, sameRepository(service, input(7, "yekta", "BIO")))
	assert.False(t, sameRepository(service, input(8, "yekta", "bio")))
	assert.False(t, sameRepository(service, input(7, "other", "bio")))
	assert.False(t, sameRepository(service, input(7, "yekta", "site")))
	assert.False(t, sameRepository(&ent.Service{}, input(7, "yekta", "bio")))
}

func TestAnalysisTarget(t *testing.T) {
	config := &ent.ServiceConfig{DockerBuilderDockerfilePath: new("docker/Dockerfile"), RunCommand: new("npm start")}

	stored := analysisTarget(config, &models.UpdateServiceInput{})
	assert.Equal(t, sourceanalyzer.AnalysisTarget{DockerfilePath: "docker/Dockerfile", RunCommand: "npm start"}, stored)

	incoming := analysisTarget(config, &models.UpdateServiceInput{DockerBuilderDockerfilePath: new(""), DockerBuilderBuildContext: new("apps/web")})
	assert.Equal(t, sourceanalyzer.AnalysisTarget{BuildContext: "apps/web", RunCommand: "npm start"}, incoming)
}

func TestSummarizeAnalysis(t *testing.T) {
	port := 3000
	framework := summarizeAnalysis(schema.ServiceTypeGithub, &sourceanalyzer.AnalysisResult{Provider: enum.Node, Framework: enum.Next, Port: &port})
	assert.Equal(t, detectedSource{provider: enum.Node, framework: enum.Next, icon: string(enum.Next), ports: []schema.PortSpec{{Port: 3000}}}, framework)

	provider := summarizeAnalysis(schema.ServiceTypeGithub, &sourceanalyzer.AnalysisResult{Provider: enum.Go, Framework: enum.UnknownFramework})
	assert.Equal(t, detectedSource{provider: enum.Go, framework: enum.UnknownFramework, icon: string(enum.Go), ports: []schema.PortSpec{}}, provider)

	unknown := summarizeAnalysis(schema.ServiceTypeGithub, &sourceanalyzer.AnalysisResult{Provider: enum.UnknownProvider, Framework: enum.UnknownFramework})
	assert.Equal(t, "github", unknown.icon)
	assert.Empty(t, unknown.ports)
}
