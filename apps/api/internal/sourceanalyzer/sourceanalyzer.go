package sourceanalyzer

import (
	"slices"
	"strings"

	core "github.com/railwayapp/railpack/core"
	a "github.com/railwayapp/railpack/core/app"
	c "github.com/railwayapp/railpack/core/config"
	"github.com/railwayapp/railpack/core/generate"
	"github.com/railwayapp/railpack/core/logger"
	"github.com/railwayapp/railpack/core/providers"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/portdetector"
)

// The root result
type AnalysisResult struct {
	Provider  enum.Provider  `json:"provider"` // Railpack provider (node, go, deno, python, java, etc.)
	Framework enum.Framework `json:"framework"`
	Port      *int           `json:"port,omitempty"`
}

func AnalyzeSourceCode(sourceDir string) (*AnalysisResult, error) {
	app, err := a.NewApp(sourceDir)
	if err != nil {
		return nil, err
	}

	// Get railpack config
	// Get the full user config based on file config, env config, and options
	logger := logger.NewLogger()
	config, err := core.GetConfig(app, &a.Environment{}, &core.GenerateBuildPlanOptions{}, logger)
	if err != nil {
		log.Errorf("Error getting config: %s", err.Error())
		return nil, err
	}

	ctx, err := generate.NewGenerateContext(app, &a.Environment{}, config, logger)
	if err != nil {
		log.Errorf("Error creating generate context: %s", err.Error())
		return nil, err
	}

	providerToUse, detectedProviderName := getProviders(ctx, config)
	ctx.Metadata.Set("providers", detectedProviderName)

	if providerToUse != nil {
		err = providerToUse.Plan(ctx)
		if err != nil {
			log.Errorf("Error running provider plan: %s", err.Error())
			return nil, err
		}
	}

	detectedProvider := enum.ParseProvider([]string{strings.ToLower(detectedProviderName)})
	detectedFramework := enum.DetectFramework(detectedProvider, ctx)
	// Reclassify bun as provider not framework
	if detectedFramework == enum.BunFW {
		detectedProvider = enum.Bun
		detectedFramework = enum.UnknownFramework
	}

	// Check for express as railpack doesn't return it, also drill down into vite because we might get more specific
	if slices.Contains([]enum.Provider{enum.Node, enum.Bun, enum.Deno}, detectedProvider) && (detectedFramework == enum.UnknownFramework || detectedFramework == enum.Vite) {
		detectedFramework = DetectFramework(detectedProvider, sourceDir)
	}

	// Detect port
	detector := &portdetector.PortDetector{
		Provider:  detectedProvider,
		Framework: detectedFramework,
		SourceDir: sourceDir,
	}

	detectedPort, _ := detector.DetectPort()

	return &AnalysisResult{
		Provider:  detectedProvider,
		Framework: detectedFramework,
		Port:      detectedPort,
	}, nil
}

func getProviders(ctx *generate.GenerateContext, config *c.Config) (providers.Provider, string) {
	allProviders := providers.GetLanguageProviders()

	var providerToUse providers.Provider
	var detectedProvider string

	// Even if there are providers manually specified, we want to detect to see what type of app this is
	for _, provider := range allProviders {
		matched, err := provider.Detect(ctx)
		if err != nil {
			log.Warnf("Failed to detect provider `%s`: %s", provider.Name(), err.Error())
			continue
		}

		if matched {
			detectedProvider = provider.Name()

			// If there are no providers manually specified in the config,
			if config.Provider == nil {
				if err := provider.Initialize(ctx); err != nil {
					ctx.Logger.LogWarn("Failed to initialize provider `%s`: %s", provider.Name(), err.Error())
					continue
				}

				ctx.Logger.LogInfo("Detected %s", CapitalizeFirst(provider.Name()))

				providerToUse = provider
			}

			break
		}
	}

	if config.Provider != nil {
		provider := providers.GetProvider(*config.Provider)

		if provider == nil {
			ctx.Logger.LogWarn("Provider `%s` not found", *config.Provider)
			return providerToUse, detectedProvider
		}

		if err := provider.Initialize(ctx); err != nil {
			ctx.Logger.LogWarn("Failed to initialize provider `%s`: %s", *config.Provider, err.Error())
			return providerToUse, detectedProvider
		}

		ctx.Logger.LogInfo("Using provider %s from config", CapitalizeFirst(*config.Provider))
		providerToUse = provider
	}

	return providerToUse, detectedProvider
}

func CapitalizeFirst(s string) string {
	if s == "" {
		return ""
	}

	runes := []rune(s)
	runes[0] = []rune(strings.ToUpper(string(runes[0])))[0]
	return string(runes)
}
