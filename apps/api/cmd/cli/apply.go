package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

func runApplyManifests(cfg *config.Config, args []string) {
	flagSet := flag.NewFlagSet("update:apply-manifests", flag.ExitOnError)
	file := flagSet.String("file", "", "Path to the rendered manifests file")
	_ = flagSet.Parse(args)

	if *file == "" {
		fmt.Fprintln(os.Stderr, "Error: file is required")
		flagSet.Usage()
		os.Exit(1)
	}

	manifests, err := os.ReadFile(*file)
	if err != nil {
		fatalApply("failed to read manifests: %v", err)
	}

	restConfig, err := buildRestConfig(cfg.KubeConfig)
	if err != nil {
		fatalApply("failed to build kubernetes config: %v", err)
	}

	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		fatalApply("failed to create dynamic client: %v", err)
	}

	discoveryClient, err := discovery.NewDiscoveryClientForConfig(restConfig)
	if err != nil {
		fatalApply("failed to create discovery client: %v", err)
	}

	applier := k8s.NewApplier(dynamicClient, discoveryClient, cfg.SystemNamespace)
	if err := applier.Apply(context.Background(), manifests); err != nil {
		fatalApply("failed to apply manifests: %v", err)
	}

	fmt.Printf("Applied manifests from %s\n", *file)
}

func buildRestConfig(kubeConfigPath string) (*rest.Config, error) {
	if kubeConfigPath != "" {
		return clientcmd.BuildConfigFromFlags("", kubeConfigPath)
	}
	return rest.InClusterConfig()
}

func fatalApply(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
