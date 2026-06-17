package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/database"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	"github.com/unbindapp/unbind-api/pkg/builder/builders"
	"github.com/unbindapp/unbind-api/pkg/builder/config"
	"github.com/unbindapp/unbind-api/pkg/builder/k8s"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	_ "go.uber.org/automaxprocs"
	corev1 "k8s.io/api/core/v1"
)

var Version = "development"

func markDeploymentSuccessful(ctx context.Context, cfg *config.Config, webhooksService *webhooks_service.WebhooksService, tx repository.TxInterface, repo *repositories.Repositories, deploymentID uuid.UUID) error {
	_, err := repo.Deployment().MarkSucceeded(ctx, tx, deploymentID, time.Now())
	if err != nil {
		return err
	}

	// Trigger webhook
	event := schema.WebhookEventDeploymentSucceeded
	level := webhooks_service.WebhookLevelDeploymentSucceeded

	// Get service with edges
	serviceID, _ := uuid.Parse(cfg.ServiceRef)
	service, err := repo.Service().GetByID(context.Background(), serviceID)
	if err != nil {
		log.Warnf("Failed to get service for success webhook %s: %v", service.ID.String(), err)
		return nil
	}

	// Construct URL
	basePath, _ := utils.JoinURLPaths(
		cfg.ExternalUIUrl,
		service.Edges.Environment.Edges.Project.Edges.Team.ID.String(),
		"project",
		service.Edges.Environment.Edges.Project.ID.String(),
	)
	url := basePath + "?environment=" + service.EnvironmentID.String() +
		"&service=" + service.ID.String() +
		"&deployment=" + cfg.ServiceDeploymentID.String()

	data := webhooks_service.WebhookData{
		Title: "Deployment Succeeded",
		Url:   url,
		Fields: []webhooks_service.WebhookDataField{
			{
				Name:  "Service",
				Value: service.Name,
			},
			{
				Name:  "Project & Environment",
				Value: fmt.Sprintf("%s > %s", service.Edges.Environment.Edges.Project.Name, service.Edges.Environment.Name),
			},
		},
	}

	if err := webhooksService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
		log.Warnf("Failed to trigger webhook %s: %v", event, err)
	}

	return nil
}

func markDeploymentFailed(ctx context.Context, cfg *config.Config, webhooksService *webhooks_service.WebhooksService, repo *repositories.Repositories, reason string, deploymentID uuid.UUID) error {
	_, err := repo.Deployment().MarkFailed(ctx, nil, deploymentID, reason, time.Now())
	if err != nil {
		return err
	}

	// Trigger webhook
	event := schema.WebhookEventDeploymentFailed
	level := webhooks_service.WebhookLevelDeploymentFailed

	// Get service with edges
	serviceID, _ := uuid.Parse(cfg.ServiceRef)
	service, err := repo.Service().GetByID(context.Background(), serviceID)
	if err != nil {
		log.Warnf("Failed to get service %s: %v", service.ID.String(), err)
		return nil
	}

	// Construct URL
	basePath, _ := utils.JoinURLPaths(
		cfg.ExternalUIUrl,
		service.Edges.Environment.Edges.Project.Edges.Team.ID.String(),
		"project",
		service.Edges.Environment.Edges.Project.ID.String(),
	)
	url := basePath + "?environment=" + service.EnvironmentID.String() +
		"&service=" + service.ID.String() +
		"&deployment=" + cfg.ServiceDeploymentID.String()
	data := webhooks_service.WebhookData{
		Title: "Deployment Failed",
		Url:   url,
		Fields: []webhooks_service.WebhookDataField{
			{
				Name:  "Service",
				Value: service.Name,
			},
			{
				Name:  "Project & Environment",
				Value: fmt.Sprintf("%s > %s", service.Edges.Environment.Edges.Project.Name, service.Edges.Environment.Name),
			},
			{
				Name:  "Error Message",
				Value: reason,
			},
		},
	}

	if err := webhooksService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
		log.Warnf("Failed to trigger webhook %s: %v", event, err)
	}

	return nil
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	_ = godotenv.Load()

	cfg := config.NewConfig()
	_ = os.Setenv("BUILDKIT_HOST", cfg.BuildkitHost)

	log.Infof("Unbind builder %s...", Version)
	log.Info("--------------")
	log.Infof("Input Parameters:")
	log.Infof(" - Service name: %s", cfg.ServiceName)
	if cfg.ServiceDatabaseType != "" {
		log.Infof(" - Using database type: %s", cfg.ServiceDatabaseType)
		log.Infof(" - Resource definition version: %s", cfg.ServiceDatabaseDefinitionVersion)
	} else if cfg.ServiceImage != "" {
		log.Infof(" - Using docker image: %s", cfg.ServiceImage)
	} else {
		log.Infof(" - Builder Type: %s", cfg.ServiceBuilder)
		if cfg.ServiceBuilder == schema.ServiceBuilderDocker {
			dockerfileDisplay := "Dockerfile"
			if cfg.ServiceDockerBuilderDockerfilePath != "" {
				dockerfileDisplay = cfg.ServiceDockerBuilderDockerfilePath
			}
			log.Infof(" - Dockerfile Path: %s", dockerfileDisplay)
			ctxDisplay := "."
			if cfg.ServiceDockerBuilderBuildContext != "" {
				ctxDisplay = cfg.ServiceDockerBuilderBuildContext
			}
			log.Infof(" - Dockerfile Context: %s", ctxDisplay)
		}
	}
	fmt.Printf("\n")

	serviceId, err := uuid.Parse(cfg.ServiceRef)
	if err != nil {
		log.Fatalf("Failed to parse service ID, ref must be a valid uuidv4: %v", err)
	}

	// Setup database
	dbConnInfo, err := database.GetSqlDbConn(cfg, false)
	if err != nil {
		log.Fatalf("Failed to get database connection info: %v", err)
	}
	// Initialize ent client
	db, _, err := database.NewEntClient(dbConnInfo)
	if err != nil {
		log.Fatalf("Failed to create ent client: %v", err)
	}
	repo := repositories.NewRepositories(db)
	webhooksService := webhooks_service.NewWebhooksService(repo)

	// Trigger webhook
	go func() {
		event := schema.WebhookEventDeploymentBuilding
		level := webhooks_service.WebhookLevelDeploymentBuilding

		// Get service with edges
		serviceID, _ := uuid.Parse(cfg.ServiceRef)
		service, err := repo.Service().GetByID(context.Background(), serviceID)
		if err != nil {
			log.Errorf("Failed to get service %s: %v", serviceID.String(), err)
			return
		}

		// Construct URL
		url, _ := utils.JoinURLPaths(cfg.ExternalUIUrl, service.Edges.Environment.Edges.Project.Edges.Team.ID.String(), "project", service.Edges.Environment.Edges.Project.ID.String(), "?environment="+service.EnvironmentID.String(), "&service="+service.ID.String(), "&deployment="+cfg.ServiceDeploymentID.String())
		data := webhooks_service.WebhookData{
			Title: "Deployment Building",
			Url:   url,
			Fields: []webhooks_service.WebhookDataField{
				{
					Name:  "Service",
					Value: service.Name,
				},
				{
					Name:  "Project & Environment",
					Value: fmt.Sprintf("%s > %s", service.Edges.Environment.Edges.Project.Name, service.Edges.Environment.Name),
				},
			},
		}

		if err := webhooksService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
			log.Errorf("Failed to trigger webhook %s: %v", event, err)
		}
	}()

	builder := builders.NewBuilder(cfg)
	k8s := k8s.NewK8SClient(cfg, cfg, repo)

	var dockerImg string
	buildSecrets := make(map[string]string)
	additionalEnv := make(map[string]string)

	if cfg.RailpackInstallCommand != "" {
		buildSecrets["RAILPACK_INSTALL_CMD"] = cfg.RailpackInstallCommand
	}

	if cfg.RailpackBuildCommand != "" {
		buildSecrets["RAILPACK_BUILD_CMD"] = cfg.RailpackBuildCommand
	}

	var securityContext *corev1.SecurityContext
	if cfg.SecurityContext != "" {
		if err := json.Unmarshal([]byte(cfg.SecurityContext), &securityContext); err != nil {
			if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed to unmarshal security context %v", err), cfg.ServiceDeploymentID); err != nil {
				log.Errorf("Failed to mark deployment as failed: %v", err)
			}
			log.Fatalf("Failed to parse security context: %v", err)
		}
	}

	var healthCheck *v1.HealthCheckSpec
	if cfg.ServiceHealthCheck != "" {
		if err := json.Unmarshal([]byte(cfg.ServiceHealthCheck), &healthCheck); err != nil {
			if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed to unmarshal health check %v", err), cfg.ServiceDeploymentID); err != nil {
				log.Errorf("Failed to mark deployment as failed: %v", err)
			}
			log.Fatalf("Failed to parse health check: %v", err)
		}
	}

	var variableMounts []v1.VariableMountSpec
	if cfg.ServiceVariableMounts != "" {
		if err := json.Unmarshal([]byte(cfg.ServiceVariableMounts), &variableMounts); err != nil {
			if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed to unmarshal variable mounts %v", err), cfg.ServiceDeploymentID); err != nil {
				log.Errorf("Failed to mark deployment as failed: %v", err)
			}
			log.Fatalf("Failed to parse variable mounts: %v", err)
		}
	}

	if cfg.AdditionalEnv != "" {
		if err := json.Unmarshal([]byte(cfg.AdditionalEnv), &additionalEnv); err != nil {
			if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed to unmarshal additional env %v", err), cfg.ServiceDeploymentID); err != nil {
				log.Errorf("Failed to mark deployment as failed: %v", err)
			}
			log.Fatalf("Failed to parse additional env: %v", err)
		}

		for k, v := range additionalEnv {
			data, err := base64.StdEncoding.DecodeString(v)
			if err != nil {
				log.Warnf("Error decoding additional env %s: %v\n", k, err)
				continue
			}
			additionalEnv[k] = string(data)
			buildSecrets[k] = string(data)
		}
	}

	// We can bypass any build step if the image is already provided
	if cfg.ServiceImage != "" || cfg.ServiceType == schema.ServiceTypeDatabase {
		dockerImg = cfg.ServiceImage
	} else {
		// Parse build secrets from env
		serializableSecrets := make(map[string]string)
		if cfg.ServiceBuildSecrets != "" {
			if err := json.Unmarshal([]byte(cfg.ServiceBuildSecrets), &serializableSecrets); err != nil {
				if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed to unmarshal secrets %v", err), cfg.ServiceDeploymentID); err != nil {
					log.Errorf("Failed to mark deployment as failed: %v", err)
				}
				log.Fatalf("Failed to parse secrets: %v", err)
			}

			// Convert back to map[string][]byte
			for k, v := range serializableSecrets {
				data, err := base64.StdEncoding.DecodeString(v)
				if err != nil {
					log.Warnf("Error decoding secret %s: %v\n", k, err)
					continue
				}
				buildSecrets[k] = string(data)
			}
		}

		// Build with context
		switch cfg.ServiceBuilder {
		case schema.ServiceBuilderRailpack:
			dockerImg, _, err = builder.BuildWithRailpack(ctx, buildSecrets)
			if err != nil {
				if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed railpack build %v", err), cfg.ServiceDeploymentID); err != nil {
					log.Errorf("Failed to mark deployment as failed: %v", err)
				}
				log.Fatalf("Failed to build with railpack: %v", err)
			}
		case schema.ServiceBuilderDocker:
			dockerImg, _, err = builder.BuildDockerfile(ctx, buildSecrets)
			if err != nil {
				if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed docker build %v", err), cfg.ServiceDeploymentID); err != nil {
					log.Errorf("Failed to mark deployment as failed: %v", err)
				}
				log.Fatalf("Failed to build with docker: %v", err)
			}
		default:
			if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("received request with unknown builder: %s", cfg.ServiceBuilder), cfg.ServiceDeploymentID); err != nil {
				log.Errorf("Failed to mark deployment as failed: %v", err)
			}
			log.Fatalf("Unknown builder: %s", cfg.ServiceBuilder)
		}
	}

	crdName := cfg.ServiceName
	if crdName == "" {
		log.Fatal("Service name not provided, cannot deploy")
	}

	// Database doesn't need a build, so bypass
	if dockerImg == "" && cfg.ServiceType != schema.ServiceTypeDatabase {
		if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, "no output image generated", cfg.ServiceDeploymentID); err != nil {
			log.Errorf("Failed to mark deployment as failed: %v", err)
		}
		log.Error("Failed to build image to deploy!")
		os.Exit(1)
	}

	// Deploy to kubernetes with context
	_, serviceSpec, err := k8s.DeployImage(ctx, crdName, dockerImg, additionalEnv, securityContext, healthCheck, variableMounts)
	if err != nil {
		if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed to deploy image %v", err), cfg.ServiceDeploymentID); err != nil {
			log.Errorf("Failed to mark deployment as failed: %v", err)
		}
		log.Fatalf("Failed to deploy image: %v", err)
	}

	// Update deployment metadata in the DB
	if err := repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if _, err = repo.Deployment().AttachDeploymentMetadata(
			ctx,
			tx,
			cfg.ServiceDeploymentID,
			dockerImg,
			serviceSpec,
		); err != nil {
			log.Error("Failed to attach deployment metadata", "deployment_id", cfg.ServiceDeploymentID, "err", err)
		}

		// Update active deployment
		if err = repo.Service().SetCurrentDeployment(ctx, tx, serviceId, cfg.ServiceDeploymentID); err != nil {
			log.Error("Failed to set current deployment", "service_id", serviceId, "deployment_id", cfg.ServiceDeploymentID, "err", err)
		}

		if err = markDeploymentSuccessful(ctx, cfg, webhooksService, tx, repo, cfg.ServiceDeploymentID); err != nil {
			log.Error("Failed to mark deployment as successful", "deployment_id", cfg.ServiceDeploymentID, "err", err)
		}
		return nil
	}); err != nil {
		if err := markDeploymentFailed(ctx, cfg, webhooksService, repo, fmt.Sprintf("failed to update deployment metadata %v", err), cfg.ServiceDeploymentID); err != nil {
			log.Errorf("Failed to mark deployment as failed: %v", err)
		}
		log.Fatalf("Failed to update deployment metadata: %v", err)
	}

	log.Infof("Deployment successful, deployment ID: %s", cfg.ServiceDeploymentID.String())
}
