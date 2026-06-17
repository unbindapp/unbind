package operator

import (
	"context"
	"fmt"
	"strings"
	"time"

	helmv2 "github.com/fluxcd/helm-controller/api/v2"
	sourcev1 "github.com/fluxcd/source-controller/api/v1"
	"github.com/go-logr/logr"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/discovery"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// operatorSpec describes how to detect and install a dependent operator via Flux Helm.
type operatorSpec struct {
	// groupVersion and kind identify the CRD whose presence indicates the operator is installed.
	groupVersion string
	kind         string
	// name is shared by the HelmRepository and HelmRelease.
	name         string
	repoURL      string
	chart        string
	chartVersion string
	values       string
}

// operatorSpecs is the registry of supported dependent operators keyed by database type.
var operatorSpecs = map[string]operatorSpec{
	"mysql": {
		groupVersion: "moco.cybozu.com/v1beta2",
		kind:         "MySQLCluster",
		name:         "moco-operator",
		repoURL:      "https://cybozu-go.github.io/moco/",
		chart:        "moco",
		chartVersion: "0.25.0",
		values: `{
			"replicaCount": 1,
			"resources": {
				"requests": {
					"cpu": "10m",
					"memory": "20Mi"
				}
			}
		}`,
	},
	"clickhouse": {
		groupVersion: "clickhouse.altinity.com/v1",
		kind:         "ClickHouseInstallation",
		name:         "clickhouse-operator",
		repoURL:      "https://docs.altinity.com/clickhouse-operator/",
		chart:        "altinity-clickhouse-operator",
		chartVersion: "0.27.1",
		values: `{
			"operator": {
				"image": {
					"repository": "altinity/clickhouse-operator",
					"pullPolicy": "IfNotPresent"
				},
				"resources": {
					"requests": {
						"cpu": "10m",
						"memory": "20Mi"
					}
				},
				"env": [
					{
						"name": "WATCH_NAMESPACES",
						"value": ".*"
					}
				]
			},
			"metrics": {
				"enabled": false
			},
			"serviceAccount": {
				"create": true
			},
			"rbac": {
				"create": true
			},
			"secret": {
				"create": true,
				"username": "clickhouse_operator",
				"password": "clickhouse_operator_password"
			}
		}`,
	},
}

// OperatorManager handles the installation and management of required operators
type OperatorManager struct {
	client    client.Client
	scheme    *runtime.Scheme
	discovery discovery.DiscoveryInterface
}

// NewOperatorManager creates a new OperatorManager instance
func NewOperatorManager(client client.Client, scheme *runtime.Scheme, discovery discovery.DiscoveryInterface) *OperatorManager {
	return &OperatorManager{
		client:    client,
		scheme:    scheme,
		discovery: discovery,
	}
}

// EnsureOperatorInstalled checks if the required operator is installed and installs it if needed
func (m *OperatorManager) EnsureOperatorInstalled(ctx context.Context, logger logr.Logger, operatorType string, namespace string) error {
	spec, ok := operatorSpecs[operatorType]
	if !ok {
		return fmt.Errorf("unsupported operator type: %s", operatorType)
	}

	installed, err := m.isOperatorInstalled(spec)
	if err != nil {
		return fmt.Errorf("failed to check if operator is installed: %w", err)
	}
	if installed {
		logger.Info("Operator already installed", "type", operatorType, "namespace", namespace)
		return nil
	}

	logger.Info("Installing operator", "type", operatorType, "namespace", namespace)
	if err := m.createIfNotExists(ctx, logger, spec.helmRepository(namespace)); err != nil {
		return err
	}
	return m.createIfNotExists(ctx, logger, spec.helmRelease(namespace))
}

// isOperatorInstalled reports whether the operator's CRD is present in the cluster.
func (m *OperatorManager) isOperatorInstalled(spec operatorSpec) (bool, error) {
	resources, err := m.discovery.ServerResourcesForGroupVersion(spec.groupVersion)
	if err != nil {
		// A missing API group means the CRD - and therefore the operator - is not installed.
		if discovery.IsGroupDiscoveryFailedError(err) || errors.IsNotFound(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to check %s operator installation: %w", spec.kind, err)
	}

	for _, r := range resources.APIResources {
		if strings.EqualFold(r.Kind, spec.kind) {
			return true, nil
		}
	}
	return false, nil
}

// createIfNotExists creates obj, treating an already-existing object as success.
func (m *OperatorManager) createIfNotExists(ctx context.Context, logger logr.Logger, obj client.Object) error {
	kind := fmt.Sprintf("%T", obj)
	if err := m.client.Create(ctx, obj); err != nil {
		if !errors.IsAlreadyExists(err) {
			return fmt.Errorf("failed to create %s: %w", kind, err)
		}
		logger.Info("Resource already exists", "kind", kind, "name", obj.GetName(), "namespace", obj.GetNamespace())
		return nil
	}
	logger.Info("Created resource", "kind", kind, "name", obj.GetName(), "namespace", obj.GetNamespace())
	return nil
}

func (s operatorSpec) helmRepository(namespace string) *sourcev1.HelmRepository {
	return &sourcev1.HelmRepository{
		ObjectMeta: metav1.ObjectMeta{Name: s.name, Namespace: namespace},
		Spec: sourcev1.HelmRepositorySpec{
			URL:      s.repoURL,
			Interval: metav1.Duration{Duration: time.Hour},
		},
	}
}

func (s operatorSpec) helmRelease(namespace string) *helmv2.HelmRelease {
	return &helmv2.HelmRelease{
		ObjectMeta: metav1.ObjectMeta{Name: s.name, Namespace: namespace},
		Spec: helmv2.HelmReleaseSpec{
			Interval: metav1.Duration{Duration: time.Hour},
			Chart: &helmv2.HelmChartTemplate{
				Spec: helmv2.HelmChartTemplateSpec{
					Chart:   s.chart,
					Version: s.chartVersion,
					SourceRef: helmv2.CrossNamespaceObjectReference{
						Kind:      "HelmRepository",
						Name:      s.name,
						Namespace: namespace,
					},
				},
			},
			Values: &apiextensionsv1.JSON{Raw: []byte(s.values)},
		},
	}
}
