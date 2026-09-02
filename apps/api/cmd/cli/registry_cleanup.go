package main

import (
	"context"
	"flag"
	"os"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/registrycache"
)

func runRegistryCleanup(cfg *config.Config, args []string) {
	flagSet := flag.NewFlagSet("registry:cleanup", flag.ExitOnError)
	threshold := flagSet.String("threshold", os.Getenv(registrycache.ThresholdEnvVar), "Registry size at which pruning starts, e.g. 16Gi")
	_ = flagSet.Parse(args)

	if *threshold == "" {
		fatalf("threshold is required, set --threshold or %s", registrycache.ThresholdEnvVar)
	}

	qty, err := utils.ValidateStorageQuantity(*threshold)
	if err != nil {
		fatalf("invalid threshold: %v", err)
	}

	restConfig, err := buildRestConfig(cfg.KubeConfig)
	if err != nil {
		fatalf("failed to build kubernetes config: %v", err)
	}

	cleaner, err := registrycache.NewCleaner(cfg.SystemNamespace, restConfig)
	if err != nil {
		fatalf("failed to create registry cleaner: %v", err)
	}

	if err := cleaner.Run(context.Background(), qty.Value()); err != nil {
		fatalf("registry cleanup failed: %v", err)
	}
}
