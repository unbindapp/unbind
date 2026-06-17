package resourcebuilder

import (
	"context"

	"github.com/go-logr/logr"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type ResourceBuilderInterface interface {
	BuildDeployment() (*appsv1.Deployment, error)
	BuildServices() ([]*corev1.Service, error)
	BuildIngress() (*networkingv1.Ingress, error)
	BuildDatabaseObjects(ctx context.Context, logger logr.Logger) ([]runtime.Object, error)
}

// Ensure ResourceBuilder implements ResourceBuilderInterface
var _ ResourceBuilderInterface = (*ResourceBuilder)(nil)
