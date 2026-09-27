package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/registrycache"
	"github.com/unbindapp/unbind-api/internal/models"
)

// Kubernetes keeps at most 4KB of a termination message
const maxReportedErrorLength = 1024

func runRegistryCleanup(cfg *config.Config, args []string) {
	flagSet := flag.NewFlagSet("registry:cleanup", flag.ExitOnError)
	threshold := flagSet.String("threshold", os.Getenv(registrycache.ThresholdEnvVar), "Registry size at which pruning starts, e.g. 16Gi")
	pruneAll := flagSet.Bool("all", false, "Delete every image cleanup is allowed to delete, even under the threshold")
	_ = flagSet.Parse(args)

	if *threshold == "" {
		failCleanup("threshold is required, set --threshold or %s", registrycache.ThresholdEnvVar)
	}

	qty, err := utils.ValidateStorageQuantity(*threshold)
	if err != nil {
		failCleanup("invalid threshold: %v", err)
	}

	restConfig, err := buildRestConfig(cfg.KubeConfig)
	if err != nil {
		failCleanup("failed to build kubernetes config: %v", err)
	}

	cleaner, err := registrycache.NewCleaner(cfg.SystemNamespace, restConfig)
	if err != nil {
		failCleanup("failed to create registry cleaner: %v", err)
	}

	result, err := cleaner.Run(context.Background(), qty.Value(), *pruneAll)
	if err != nil {
		failCleanup("registry cleanup failed: %v", err)
	}
	reportCleanup(result)
}

func failCleanup(format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	if len(message) > maxReportedErrorLength {
		message = message[:maxReportedErrorLength]
	}
	reportCleanup(&models.RegistryCleanupResult{Error: message})
	fatalf(format, args...)
}

// The API reads the result back from the container's termination message
func reportCleanup(result *models.RegistryCleanupResult) {
	data, err := json.Marshal(result)
	if err != nil {
		log.Warnf("registry cleanup: failed to encode result: %v", err)
		return
	}
	if err := os.WriteFile(registrycache.TerminationMessagePath, data, 0o644); err != nil {
		log.Warnf("registry cleanup: failed to write result: %v", err)
	}
}
