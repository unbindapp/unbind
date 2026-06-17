package buildkit

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/containerd/platforms"
	"github.com/docker/cli/cli/config/configfile"
	"github.com/docker/cli/cli/config/types"
	"github.com/moby/buildkit/client"
	"github.com/moby/buildkit/client/llb"
	"github.com/moby/buildkit/session"
	"github.com/moby/buildkit/session/auth/authprovider"
	"github.com/moby/buildkit/session/secrets/secretsprovider"
	"github.com/moby/buildkit/util/appcontext"
	specs "github.com/opencontainers/image-spec/specs-go/v1"
	rpBuildkit "github.com/railwayapp/railpack/buildkit"
	"github.com/railwayapp/railpack/core/plan"
	"github.com/tonistiigi/fsutil"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/pkg/builder/config"
)

type BuildWithBuildkitClientOptions struct {
	ImageName         string
	RailpackBuildPlan *plan.BuildPlan
	Platform          specs.Platform
	SecretsHash       string
	Secrets           map[string]string
	CacheKey          string
	DockerfilePath    string
	ContextPath       string
}

func BuildWithBuildkitClient(cfg *config.Config, appDir string, opts BuildWithBuildkitClientOptions) error {
	ctx := appcontext.Context()

	imageName := opts.ImageName
	if imageName == "" {
		imageName = getImageName(appDir)
	}

	// Handle registry URL
	if cfg.ContainerRegistryHost != "" {
		// Special handling for Docker Hub (docker.io)
		if cfg.ContainerRegistryHost == "docker.io" {
			// For Docker Hub, we expect the format: username/repository:tag
			// Don't prepend docker.io to the image name
			if !strings.Contains(imageName, "/") {
				return fmt.Errorf("docker hub requires image name in format: username/repository[:tag]")
			}
		} else {
			// For other registries, prepend registry URL if needed
			if !strings.Contains(imageName, "/") ||
				(!strings.Contains(imageName, ":") && !strings.Contains(strings.Split(imageName, "/")[0], ".")) {

				// Clean registry URL (remove http/https prefix if present)
				registryURL := cfg.ContainerRegistryHost
				registryURL = strings.TrimPrefix(registryURL, "http://")
				registryURL = strings.TrimPrefix(registryURL, "https://")
				registryURL = strings.TrimRight(registryURL, "/")

				// Prepend the registry URL to the image name
				imageName = fmt.Sprintf("%s/%s", registryURL, imageName)
			}
		}
	}

	c, err := client.New(ctx, cfg.BuildkitHost)
	if err != nil {
		return fmt.Errorf("failed to connect to buildkit: %w", err)
	}
	defer c.Close()

	// Get the buildkit info early so we can ensure we can connect to the buildkit host
	info, err := c.Info(ctx)
	if err != nil {
		return fmt.Errorf("failed to get buildkit info: %w", err)
	}

	buildPlatform := opts.Platform
	if buildPlatform.OS == "" {
		buildPlatform, _ = rpBuildkit.ParsePlatformWithDefaults("")
	}

	// Setup channel for progress monitoring
	ch := make(chan *client.SolveStatus)

	progressDone := make(chan bool)
	go func() {
		// Process the status updates directly with your custom logger
		for s := range ch {
			logBuildkitStatus(s)
		}
		progressDone <- true
	}()

	// Determine the context path
	contextPath := appDir
	if opts.ContextPath != "" {
		// If a custom context path is provided, use it
		// If it's a relative path, resolve it relative to appDir
		if !strings.HasPrefix(opts.ContextPath, "/") {
			contextPath = fmt.Sprintf("%s/%s", appDir, opts.ContextPath)
		} else {
			contextPath = opts.ContextPath
		}
	}

	// Create a filesystem for the context directory
	contextFS, err := fsutil.NewFS(contextPath)
	if err != nil {
		return fmt.Errorf("error creating context FS: %w", err)
	}

	log.Infof("Building image for %s with BuildKit %s", platforms.Format(buildPlatform), info.BuildkitVersion.Version)
	log.Infof("Using context path: %s", contextPath)

	secretsMap := make(map[string][]byte)
	for k, v := range opts.Secrets {
		secretsMap[k] = []byte(v)
	}
	secrets := secretsprovider.FromMap(secretsMap)

	// Setting up session attachments for registry auth if needed
	sessionAttachables := []session.Attachable{secrets}

	// Registry authentication setup
	if cfg.ContainerRegistryUser != "" && cfg.ContainerRegistryPassword != "" {
		// Create a new config file
		configFile := configfile.New("")

		// Use the appropriate registry host for auth
		authRegistryHost := cfg.ContainerRegistryHost
		if authRegistryHost == "docker.io" {
			// Docker Hub uses specific auth servers
			authRegistryHost = "https://index.docker.io/v1/"
		}

		// Add the auth entry for the registry
		configFile.AuthConfigs = map[string]types.AuthConfig{
			authRegistryHost: {
				Username: cfg.ContainerRegistryUser,
				Password: cfg.ContainerRegistryPassword,
				Auth:     "",
			},
		}

		// Create the auth provider configuration
		authProviderCfg := authprovider.DockerAuthProviderConfig{
			AuthConfigProvider: authprovider.LoadAuthConfig(configFile),
		}

		sessionAttachables = append(sessionAttachables, authprovider.NewDockerAuthProvider(authProviderCfg))
	}

	solveOpts := client.SolveOpt{
		LocalMounts: map[string]fsutil.FS{
			"context": contextFS,
		},
		Session: sessionAttachables,
	}

	var def *llb.Definition
	exportAttrs := map[string]string{
		"name":              imageName,
		"push":              "true",
		"compression":       "gzip",
		"compression-level": "3",
	}

	if opts.DockerfilePath != "" {
		// Using Dockerfile frontend
		log.Infof("Building image from Dockerfile: %s with BuildKit %s", opts.DockerfilePath, info.BuildkitVersion.Version)

		// If Dockerfile is outside the context, create a separate mount for it
		dockerfilePath := opts.DockerfilePath
		dockerfileDir := appDir
		dockerfileBasename := dockerfilePath

		// Handle path separators in the Dockerfile path
		if strings.Contains(dockerfilePath, "/") {
			lastSlash := strings.LastIndex(dockerfilePath, "/")

			if lastSlash != -1 {
				// Split into directory and filename
				dockerfileDir = fmt.Sprintf("%s/%s", appDir, dockerfilePath[:lastSlash])
				dockerfileBasename = dockerfilePath[lastSlash+1:]
			}
		}

		// Create filesystem for the Dockerfile directory
		dockerfileFS, err := fsutil.NewFS(dockerfileDir)
		if err != nil {
			return fmt.Errorf("error creating Dockerfile FS: %w", err)
		}

		// Always add the Dockerfile mount
		solveOpts.LocalMounts["dockerfile"] = dockerfileFS

		// Set the frontend to use Dockerfile
		solveOpts.Frontend = "dockerfile.v0"
		solveOpts.FrontendAttrs = map[string]string{
			"filename": dockerfileBasename,
		}
	} else if opts.RailpackBuildPlan != nil {
		buildPlatform := opts.Platform
		if buildPlatform.OS == "" {
			buildPlatform, _ = rpBuildkit.ParsePlatformWithDefaults("")
		}

		log.Infof("Building image for %s with BuildKit %s", platforms.Format(buildPlatform), info.BuildkitVersion.Version)

		llbState, image, err := rpBuildkit.ConvertPlanToLLB(opts.RailpackBuildPlan, rpBuildkit.ConvertPlanOptions{
			BuildPlatform: buildPlatform,
			SecretsHash:   opts.SecretsHash,
			CacheKey:      opts.CacheKey,
		})
		if err != nil {
			return fmt.Errorf("error converting plan to LLB: %w", err)
		}

		imageBytes, err := json.Marshal(image)
		if err != nil {
			return fmt.Errorf("error marshalling image: %w", err)
		}

		def, err = llbState.Marshal(ctx, llb.LinuxAmd64)
		if err != nil {
			return fmt.Errorf("error marshaling LLB state: %w", err)
		}

		// Export attributes for BuildPlan
		exportAttrs["containerimage.config"] = string(imageBytes)
	} else {
		return fmt.Errorf("no Dockerfile or Railpack build plan provided")
	}

	// Set the export configuration
	solveOpts.Exports = []client.ExportEntry{
		{
			Type:  client.ExporterImage,
			Attrs: exportAttrs,
		},
	}

	if opts.CacheKey != "" && !cfg.DisableBuildCache {
		solveOpts.CacheImports = []client.CacheOptionsEntry{
			{
				Type: "registry",
				Attrs: map[string]string{
					"ref": opts.CacheKey,
				},
			},
		}
		solveOpts.CacheExports = []client.CacheOptionsEntry{
			{
				Type: "registry",
				Attrs: map[string]string{
					"ref":  opts.CacheKey,
					"mode": "max",
				},
			},
		}
	}

	startTime := time.Now()
	_, err = c.Solve(ctx, def, solveOpts, ch)

	// Wait for progress monitoring to complete
	<-progressDone

	if err != nil {
		return fmt.Errorf("failed to solve: %w", err)
	}

	buildDuration := time.Since(startTime)
	log.Infof("Successfully built image in %.2fs", buildDuration.Seconds())

	log.Infof("image name: %s", imageName)
	return nil
}

func getImageName(appDir string) string {
	parts := strings.Split(appDir, string(os.PathSeparator))
	name := parts[len(parts)-1]
	if name == "" {
		name = "railpack-app" // Fallback if path ends in separator
	}
	return name
}

func logBuildkitStatus(s *client.SolveStatus) {
	for _, v := range s.Vertexes {
		if v.Started != nil {
			log.Infof("Buildkit: task %s started", v.Name)
		}
		if v.Completed != nil {
			if v.Error != "" {
				log.Errorf("Buildkit: task %s failed: %s", v.Name, v.Error)
			} else {
				log.Infof("Buildkit: task %s completed in %.2fs", v.Name, v.Completed.Sub(*v.Started).Seconds())
			}
		}
	}

	for _, s := range s.Statuses {
		log.Infof("Buildkit: %s %s %d/%d", s.Vertex, s.ID, s.Current, s.Total)
	}

	for _, l := range s.Logs {
		log.Infof("Buildkit log [%s]: %s", l.Vertex, string(l.Data))
	}
}
