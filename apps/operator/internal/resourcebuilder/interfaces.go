package resourcebuilder

import (
	"context"

	"github.com/go-logr/logr"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type ResourceBuilderInterface interface {
	BuildDeployment() (*appsv1.Deployment, error)
	BuildServices() ([]*corev1.Service, error)
	BuildRoutes() ([]client.Object, error)
	BuildDatabaseObjects(ctx context.Context, logger logr.Logger) ([]runtime.Object, error)
}

// Ensure ResourceBuilder implements ResourceBuilderInterface
var _ ResourceBuilderInterface = (*ResourceBuilder)(nil)
