package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/go-co-op/gocron/v2"
	_ "github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/config"
	entmigrate "github.com/unbindapp/unbind-api/ent/migrate"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/api/router"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/infrastructure/buildkitd"
	"github.com/unbindapp/unbind-api/internal/infrastructure/cache"
	"github.com/unbindapp/unbind-api/internal/infrastructure/database"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
	"github.com/unbindapp/unbind-api/internal/infrastructure/registry"
	"github.com/unbindapp/unbind-api/internal/infrastructure/registrycache"
	"github.com/unbindapp/unbind-api/internal/infrastructure/updater"
	"github.com/unbindapp/unbind-api/internal/integrations/github"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	deployments_service "github.com/unbindapp/unbind-api/internal/services/deployments"
	environment_service "github.com/unbindapp/unbind-api/internal/services/environment"
	instance_service "github.com/unbindapp/unbind-api/internal/services/instances"
	logs_service "github.com/unbindapp/unbind-api/internal/services/logs"
	metric_service "github.com/unbindapp/unbind-api/internal/services/metrics"
	project_service "github.com/unbindapp/unbind-api/internal/services/project"
	service_service "github.com/unbindapp/unbind-api/internal/services/service"
	servicegroup_service "github.com/unbindapp/unbind-api/internal/services/service_group"
	storage_service "github.com/unbindapp/unbind-api/internal/services/storage"
	system_service "github.com/unbindapp/unbind-api/internal/services/system"
	team_service "github.com/unbindapp/unbind-api/internal/services/team"
	templates_service "github.com/unbindapp/unbind-api/internal/services/templates"
	terminal_service "github.com/unbindapp/unbind-api/internal/services/terminal"
	variables_service "github.com/unbindapp/unbind-api/internal/services/variables"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	"github.com/unbindapp/unbind-api/internal/web"
	"github.com/unbindapp/unbind-api/pkg/databases"
	_ "go.uber.org/automaxprocs"
)

var Version = "development"
var BuildImage = "ghcr.io/unbindapp/unbind-builder:latest"

func startAPI(cfg *config.Config) {
	// Create a context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Set up signal handling
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-signalCh
		slog.Info("Received shutdown signal", "signal", sig)
		cancel() // This will propagate cancellation to all derived contexts
	}()

	// Initialize redis
	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisURL,
		Password: "", // no password set
		DB:       0,  // use default DB
	})
	defer redisClient.Close()

	// Load database
	dbConnInfo, err := database.GetSqlDbConn(cfg, false)
	if err != nil {
		log.Fatalf("Failed to get database connection info: %v", err)
	}
	log.Infof("Using PostgreSQL database %s@%s:%d", cfg.PostgresUser, cfg.PostgresHost, cfg.PostgresPort)
	// Initialize ent client
	db, sqlDB, err := database.NewEntClient(dbConnInfo)
	if err != nil {
		log.Fatalf("Failed to create ent client: %v", err)
	}
	log.Info("🪿 Running migrations...")

	// Migrations are embedded in the binary (see ent/migrate/embed.go).
	goose.SetLogger(log.GetLogger())
	goose.SetBaseFS(entmigrate.MigrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("🪿 goose dialect error: %v", err)
	}

	if err := goose.Up(sqlDB, "migrations", goose.WithAllowMissing()); err != nil {
		log.Fatalf("🪿 goose up err: %v", err)
	}
	log.Info("🪿 Migrations applied successfully")

	repo := repositories.NewRepositories(db)

	// Do a template sync of our pre-defined stuff
	if err := repo.Template().UpsertPredefinedTemplates(ctx); err != nil {
		log.Errorf("Failed to upsert predefined templates: %v", err)
	}

	// Create kubernetes client
	kubeClient := k8s.NewKubeClient(cfg, repo)

	// Create github client
	githubClient := github.NewGithubClient(cfg.GithubURL, cfg)

	// Buildkit settings manager
	buildkitSettings := buildkitd.NewBuildkitSettingsManager(cfg, repo, kubeClient)

	// Loki log querier
	lokiQuerier, err := loki.NewLokiLogger(cfg)
	if err != nil {
		log.Fatalf("Failed to create Loki log querier, invalid config: %v", err)
	}

	// Prometheus client
	promClient, err := prometheus.NewPrometheusClient(cfg)
	if err != nil {
		log.Fatalf("Failed to create Prometheus client: %v", err)
	}

	// Database provider
	dbProvider := databases.NewDatabaseProvider()

	// Bootstrap
	if !cfg.SkipBootstrap {
		bootstrapper := &Bootstrapper{
			cfg:                     cfg,
			kubeClient:              kubeClient,
			repos:                   repo,
			buildkitSettingsManager: buildkitSettings,
		}
		if err := bootstrapper.Sync(ctx); err != nil {
			log.Errorf("Failed to sync system settings: %v", err)
		}
	}

	// Create webhook service
	variableService := variables_service.NewVariablesService(repo, kubeClient)
	webhooksService := webhooks_service.NewWebhooksService(repo)

	// Create deployment controller
	deploymentController := deployctl.NewDeploymentController(ctx, cancel, cfg, kubeClient, redisClient, repo, githubClient, webhooksService, variableService)

	// Create registry tester
	registryTester := registry.NewRegistryTester(cfg, repo, kubeClient)

	registryCacheManager := registrycache.NewManager(cfg, kubeClient)

	// Create services
	teamService := team_service.NewTeamService(repo, kubeClient)
	projectService := project_service.NewProjectService(cfg, repo, kubeClient, webhooksService, deploymentController)
	environmentService := environment_service.NewEnvironmentService(repo, kubeClient, deploymentController)
	logService := logs_service.NewLogsService(repo, kubeClient, lokiQuerier)
	deploymentService := deployments_service.NewDeploymentService(repo, kubeClient, deploymentController, githubClient, lokiQuerier, registryTester, variableService)
	serviceService := service_service.NewServiceService(cfg, repo, githubClient, kubeClient, deploymentController, dbProvider, webhooksService, variableService, promClient, deploymentService)
	systemService := system_service.NewSystemService(cfg, repo, buildkitSettings, registryTester, registryCacheManager, kubeClient)
	systemService.ReconcileRegistryCache(ctx)
	metricsService := metric_service.NewMetricService(promClient, repo, kubeClient)
	instanceService := instance_service.NewInstanceService(cfg, repo, kubeClient)
	storageService := storage_service.NewStorageService(cfg, repo, kubeClient, promClient, serviceService)
	templateService := templates_service.NewTemplatesService(cfg, repo, kubeClient, dbProvider, deploymentController)
	serviceGroupService := servicegroup_service.NewServiceGroupService(cfg, repo, kubeClient, deploymentController)
	terminalService := terminal_service.NewTerminalService(repo, kubeClient)

	stringCache := cache.NewStringCache(redisClient, "unbind")

	pkey, _, err := repo.Oauth().GetOrGenerateJWTPrivateKey(ctx)
	if err != nil {
		log.Fatalf("Failed to load JWT signing key: %v", err)
	}
	tokenManager := auth.NewTokenManager(pkey, cfg.ExternalOauth2URL, cfg.TokenAudience)
	oidcHandler := auth.NewOIDCHandler(tokenManager)
	kubeClient.SetTokenVerifier(tokenManager)

	// Implementation
	srvImpl := &server.Server{
		KubeClient:           kubeClient,
		Cfg:                  cfg,
		Repository:           repo,
		GithubClient:         githubClient,
		StringCache:          stringCache,
		HttpClient:           &http.Client{},
		DeploymentController: deploymentController,
		DatabaseProvider:     dbProvider,
		DNSChecker:           utils.NewDNSChecker(),
		UpdateManager:        updater.New(cfg, Version, kubeClient, redisClient),
		TeamService:          teamService,
		ProjectService:       projectService,
		ServiceService:       serviceService,
		EnvironmentService:   environmentService,
		LogService:           logService,
		DeploymentService:    deploymentService,
		SystemService:        systemService,
		MetricsService:       metricsService,
		WebhooksService:      webhooksService,
		InstanceService:      instanceService,
		VariablesService:     variableService,
		StorageService:       storageService,
		TemplateService:      templateService,
		ServiceGroupService:  serviceGroupService,
		TerminalService:      terminalService,
		TokenManager:         tokenManager,
	}

	// New chi router
	r := chi.NewRouter()

	allowedOrigins := []string{
		cfg.ExternalUIUrl,
	}

	if cfg.InjectDevOrigins {
		allowedOrigins = append(allowedOrigins, []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"*.unbind.app",
		}...)
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		// AllowOriginFunc:  func(r *http.Request, origin string) bool { return true },
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	}))

	r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"version": "` + Version + `"}`))
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// OIDC discovery + JWKS for token-consuming clients. The ingress routes the
	// issuer path (/api/oauth2) here.
	r.Get("/.well-known/openid-configuration", oidcHandler.HandleOpenIDConfiguration)
	r.Get("/.well-known/jwks.json", oidcHandler.HandleJWKS)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RealIP)
		r.Use(middleware.Logger)

		// Register huma error function
		huma.NewError = errdefs.HumaErrorFunc

		config := router.NewHumaConfig("Unbind API", "1.0.0", cfg.CookieSecure)
		config.DocsPath = ""
		config.Servers = []*huma.Server{
			{
				URL: cfg.ExternalAPIURL,
			},
		}
		api := humachi.New(r, config)

		// Create middleware
		mw := middleware.NewMiddleware(cfg, repo, api, tokenManager, allowedOrigins)

		api.UseMiddleware(mw.Recoverer)

		r.Get("/docs", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte(`<!doctype html>
			<html>
				<head>
					<title>API Reference</title>
					<meta charset="utf-8" />
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1" />
				</head>
				<body>
					<script
						id="api-reference"
						data-url="/openapi.json"></script>
					<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.29.3"></script>
				</body>
			</html>`))
		})

		router.RegisterRoutes(api, srvImpl, mw, allowedOrigins)
	})

	// Serve the embedded SPA for any path the API doesn't claim. In the deployed
	// topology the ingress strips the /api/go prefix, so API calls arrive at root
	// and match above; everything else (assets, client routes) falls through here.
	r.NotFound(web.Handler().ServeHTTP)

	// Start the server
	addr := ":8089"
	log.Infof("Starting server on %s\n", addr)

	// Serve HTTP/1.1 and cleartext HTTP/2 (h2c) so a TLS-terminating ingress can
	// reach the backend over HTTP/2 without TLS.
	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetUnencryptedHTTP2(true)

	server := &http.Server{
		Addr:      addr,
		Handler:   r,
		Protocols: protocols,
	}

	// Start deployment queue processeor
	deploymentController.StartAsync()

	// Start cron jobs
	// Initialize scheduler
	scheduler, err := gocron.NewScheduler(gocron.WithLocation(time.UTC))
	if err != nil {
		log.Fatal("Failed to create scheduler", "err", err)
	}

	// ! TODO - we should leverage redis or something to prevent concurrent runs
	// Clean up test DNS ingresses
	_, err = scheduler.NewJob(
		gocron.DurationJob(10*time.Minute),
		gocron.NewTask(
			func(ctx context.Context) {
				log.Infof("Cleaning up verification routes.")
				if err := kubeClient.DeleteOldVerificationRoutes(ctx, kubeClient.GetInternalClient()); err != nil {
					log.Error("Failed to delete old verification routes", "err", err)
				}
			},
			ctx,
		),
	)
	if err != nil {
		log.Fatal("Failed to create ingress cleanup job", "err", err)
	}

	// Keep database variables in sync
	_, err = scheduler.NewJob(
		gocron.DurationJob(10*time.Minute),
		gocron.NewTask(
			func(ctx context.Context) {
				log.Infof("Syncing database secrets.")
				if err := kubeClient.SyncDatabaseSecrets(ctx); err != nil {
					log.Error("Failed to sync database secrets", "err", err)
				}
			},
			ctx,
		),
	)
	if err != nil {
		log.Fatal("Failed to create database sync job", "err", err)
	}

	// Start the scheduler
	scheduler.Start()
	defer func() {
		if err := scheduler.Shutdown(); err != nil {
			log.Error("Scheduler shutdown error", "err", err)
		} else {
			log.Info("Scheduler gracefully stopped")
		}
	}()

	// Start the server in a goroutine
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for context cancellation (from signal handler)
	<-ctx.Done()
	log.Info("Shutting down server...")

	// Create a shutdown context with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	// Shutdown the HTTP server
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server shutdown error: %v", err)
	}

	log.Info("Server gracefully stopped")
}

func main() {
	log.Infof("Starting Unbind API version %s", Version)
	// Load environment variables from .env file
	err := godotenv.Overload()
	if err != nil {
		log.Warn("Error loading .env file:", err)
	}

	cfg := config.NewConfig()
	cfg.BuildImage = BuildImage
	startAPI(cfg)
}
