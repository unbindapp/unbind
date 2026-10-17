package k8s

import (
	"context"
	"fmt"
	"slices"
	"sync"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
)

const (
	TeamNamespaceLabel = "unbind.app/team-namespace"

	networkPolicyKindLabel  = "unbind.app/network-policy"
	teamIsolationPolicyName = "unbind-team-isolation"
	namespaceNameLabel      = "kubernetes.io/metadata.name"
	serviceIDLabel          = "unbind-service"
)

type NetworkException struct {
	ID              uuid.UUID
	SourceNamespace string
	SourceServiceID *uuid.UUID
	TargetNamespace string
	TargetServiceID uuid.UUID
}

// NetworkPolicyManager keeps every team namespace closed to the other teams, except for network exceptions.
type NetworkPolicyManager struct {
	repo   repositories.RepositoriesInterface
	client kubernetes.Interface
	mu     sync.Mutex
}

func NewNetworkPolicyManager(repo repositories.RepositoriesInterface, client kubernetes.Interface) *NetworkPolicyManager {
	return &NetworkPolicyManager{
		repo:   repo,
		client: client,
	}
}

func (self *NetworkPolicyManager) Sync(ctx context.Context) error {
	self.mu.Lock()
	defer self.mu.Unlock()

	teams, err := self.repo.Team().GetAll(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to get teams: %w", err)
	}
	namespaces := make([]string, len(teams))
	for i, team := range teams {
		namespaces[i] = team.Namespace
	}

	if err := self.labelTeamNamespaces(ctx, namespaces); err != nil {
		return err
	}

	enabled, err := self.isolationEnabled(ctx)
	if err != nil {
		return err
	}
	if !enabled {
		return self.apply(ctx, nil)
	}

	exceptions, err := self.networkExceptions(ctx)
	if err != nil {
		return err
	}
	nodePortServices, err := self.nodePortServices(ctx, namespaces)
	if err != nil {
		return err
	}

	return self.apply(ctx, DesiredNetworkPolicies(namespaces, nodePortServices, exceptions))
}

func (self *NetworkPolicyManager) isolationEnabled(ctx context.Context) (bool, error) {
	settings, err := self.repo.System().GetSystemSettings(ctx, nil)
	if ent.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to get system settings: %w", err)
	}
	return settings.TeamNetworkIsolation, nil
}

func (self *NetworkPolicyManager) labelTeamNamespaces(ctx context.Context, namespaces []string) error {
	patch := fmt.Appendf(nil, `{"metadata":{"labels":{%q:"true"}}}`, TeamNamespaceLabel)
	for _, name := range namespaces {
		namespace, err := self.client.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
		if errors.IsNotFound(err) {
			log.Warnf("Team namespace %s does not exist", name)
			continue
		}
		if err != nil {
			return fmt.Errorf("failed to get namespace %s: %w", name, err)
		}
		if namespace.Labels[TeamNamespaceLabel] == "true" {
			continue
		}
		if _, err := self.client.CoreV1().Namespaces().Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{}); err != nil {
			return fmt.Errorf("failed to label namespace %s: %w", name, err)
		}
	}
	return nil
}

func (self *NetworkPolicyManager) networkExceptions(ctx context.Context) ([]NetworkException, error) {
	stored, err := self.repo.System().GetNetworkExceptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get network exceptions: %w", err)
	}

	exceptions := make([]NetworkException, 0, len(stored))
	for _, exception := range stored {
		targetNamespace := serviceNamespace(exception.Edges.TargetService)
		if targetNamespace == "" {
			continue
		}
		converted := NetworkException{
			ID:              exception.ID,
			SourceServiceID: exception.SourceServiceID,
			TargetNamespace: targetNamespace,
			TargetServiceID: exception.TargetServiceID,
		}
		if exception.SourceServiceID != nil {
			converted.SourceNamespace = serviceNamespace(exception.Edges.SourceService)
			if converted.SourceNamespace == "" {
				continue
			}
		}
		exceptions = append(exceptions, converted)
	}
	return exceptions, nil
}

func serviceNamespace(service *ent.Service) string {
	if service == nil || service.Edges.Environment == nil || service.Edges.Environment.Edges.Project == nil || service.Edges.Environment.Edges.Project.Edges.Team == nil {
		return ""
	}
	return service.Edges.Environment.Edges.Project.Edges.Team.Namespace
}

func (self *NetworkPolicyManager) nodePortServices(ctx context.Context, namespaces []string) ([]corev1.Service, error) {
	services, err := self.client.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}

	var nodePortServices []corev1.Service
	for _, service := range services.Items {
		if service.Spec.Type != corev1.ServiceTypeNodePort || !slices.Contains(namespaces, service.Namespace) {
			continue
		}
		nodePortServices = append(nodePortServices, service)
	}
	return nodePortServices, nil
}

func (self *NetworkPolicyManager) apply(ctx context.Context, desired []networkingv1.NetworkPolicy) error {
	existing, err := self.client.NetworkingV1().NetworkPolicies("").List(ctx, metav1.ListOptions{LabelSelector: networkPolicyKindLabel})
	if err != nil {
		return fmt.Errorf("failed to list network policies: %w", err)
	}

	current := make(map[string]networkingv1.NetworkPolicy, len(existing.Items))
	for _, policy := range existing.Items {
		current[policy.Namespace+"/"+policy.Name] = policy
	}

	for _, policy := range desired {
		key := policy.Namespace + "/" + policy.Name
		found, ok := current[key]
		delete(current, key)

		if !ok {
			if _, err := self.client.NetworkingV1().NetworkPolicies(policy.Namespace).Create(ctx, &policy, metav1.CreateOptions{}); err != nil {
				return fmt.Errorf("failed to create network policy %s: %w", key, err)
			}
			continue
		}
		if equality.Semantic.DeepEqual(found.Spec, policy.Spec) && equality.Semantic.DeepEqual(found.Labels, policy.Labels) {
			continue
		}
		found.Spec = policy.Spec
		found.Labels = policy.Labels
		if _, err := self.client.NetworkingV1().NetworkPolicies(policy.Namespace).Update(ctx, &found, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("failed to update network policy %s: %w", key, err)
		}
	}

	for key, stale := range current {
		err := self.client.NetworkingV1().NetworkPolicies(stale.Namespace).Delete(ctx, stale.Name, metav1.DeleteOptions{})
		if err != nil && !errors.IsNotFound(err) {
			return fmt.Errorf("failed to delete network policy %s: %w", key, err)
		}
	}
	return nil
}

// DesiredNetworkPolicies closes every team namespace to the other teams. Ports exposed on
// the servers stay open to everyone, and each exception opens one service to another one.
func DesiredNetworkPolicies(namespaces []string, nodePortServices []corev1.Service, exceptions []NetworkException) []networkingv1.NetworkPolicy {
	var policies []networkingv1.NetworkPolicy
	for _, namespace := range namespaces {
		policies = append(policies, teamIsolationPolicy(namespace))
	}
	for _, service := range nodePortServices {
		if policy, ok := nodePortPolicy(service); ok {
			policies = append(policies, policy)
		}
	}
	for _, exception := range exceptions {
		if !slices.Contains(namespaces, exception.TargetNamespace) {
			continue
		}
		policies = append(policies, exceptionPolicy(exception))
	}
	return policies
}

func networkPolicyMeta(name, namespace, kind string) metav1.ObjectMeta {
	return metav1.ObjectMeta{
		Name:      name,
		Namespace: namespace,
		Labels: map[string]string{
			"app.kubernetes.io/managed-by": "unbind",
			networkPolicyKindLabel:         kind,
		},
	}
}

func teamIsolationPolicy(namespace string) networkingv1.NetworkPolicy {
	return networkingv1.NetworkPolicy{
		ObjectMeta: networkPolicyMeta(teamIsolationPolicyName, namespace, "team-isolation"),
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{},
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			Ingress: []networkingv1.NetworkPolicyIngressRule{{
				From: []networkingv1.NetworkPolicyPeer{
					{PodSelector: &metav1.LabelSelector{}},
					{NamespaceSelector: &metav1.LabelSelector{
						MatchExpressions: []metav1.LabelSelectorRequirement{{
							Key:      TeamNamespaceLabel,
							Operator: metav1.LabelSelectorOpDoesNotExist,
						}},
					}},
				},
			}},
		},
	}
}

func nodePortPolicy(service corev1.Service) (networkingv1.NetworkPolicy, bool) {
	// An empty selector would open every pod in the namespace
	if len(service.Spec.Selector) == 0 || len(service.Spec.Ports) == 0 {
		return networkingv1.NetworkPolicy{}, false
	}

	ports := make([]networkingv1.NetworkPolicyPort, len(service.Spec.Ports))
	for i, servicePort := range service.Spec.Ports {
		port := servicePort.TargetPort
		if port.Type == intstr.Int && port.IntVal == 0 {
			port = intstr.FromInt32(servicePort.Port)
		}
		protocol := servicePort.Protocol
		if protocol == "" {
			protocol = corev1.ProtocolTCP
		}
		ports[i] = networkingv1.NetworkPolicyPort{Protocol: &protocol, Port: &port}
	}

	return networkingv1.NetworkPolicy{
		ObjectMeta: networkPolicyMeta("unbind-nodeport-"+service.Name, service.Namespace, "nodeport"),
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{MatchLabels: service.Spec.Selector},
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			Ingress:     []networkingv1.NetworkPolicyIngressRule{{Ports: ports}},
		},
	}, true
}

func exceptionPolicy(exception NetworkException) networkingv1.NetworkPolicy {
	rule := networkingv1.NetworkPolicyIngressRule{}
	if exception.SourceServiceID != nil {
		rule.From = []networkingv1.NetworkPolicyPeer{{
			NamespaceSelector: &metav1.LabelSelector{MatchLabels: map[string]string{namespaceNameLabel: exception.SourceNamespace}},
			PodSelector:       &metav1.LabelSelector{MatchLabels: map[string]string{serviceIDLabel: exception.SourceServiceID.String()}},
		}}
	}

	return networkingv1.NetworkPolicy{
		ObjectMeta: networkPolicyMeta("unbind-exception-"+exception.ID.String(), exception.TargetNamespace, "exception"),
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{MatchLabels: map[string]string{serviceIDLabel: exception.TargetServiceID.String()}},
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			Ingress:     []networkingv1.NetworkPolicyIngressRule{rule},
		},
	}
}
