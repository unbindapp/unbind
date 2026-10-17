package k8s

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_system_repo "github.com/unbindapp/unbind-api/mocks/repository/system"
	mocks_team_repo "github.com/unbindapp/unbind-api/mocks/repository/team"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes/fake"
)

func policyNames(policies []networkingv1.NetworkPolicy) []string {
	names := make([]string, len(policies))
	for i, policy := range policies {
		names[i] = policy.Namespace + "/" + policy.Name
	}
	return names
}

func TestTeamIsolationPolicyAllowsOwnNamespaceAndNonTeamNamespacesOnly(t *testing.T) {
	policies := DesiredNetworkPolicies([]string{"team-a"}, nil, nil)
	require.Len(t, policies, 1)

	spec := policies[0].Spec
	assert.Equal(t, metav1.LabelSelector{}, spec.PodSelector)
	assert.Equal(t, []networkingv1.PolicyType{networkingv1.PolicyTypeIngress}, spec.PolicyTypes)
	require.Len(t, spec.Ingress, 1)
	require.Len(t, spec.Ingress[0].From, 2)
	assert.Equal(t, &metav1.LabelSelector{}, spec.Ingress[0].From[0].PodSelector)
	assert.Nil(t, spec.Ingress[0].From[0].NamespaceSelector)
	assert.Equal(t, []metav1.LabelSelectorRequirement{{Key: TeamNamespaceLabel, Operator: metav1.LabelSelectorOpDoesNotExist}}, spec.Ingress[0].From[1].NamespaceSelector.MatchExpressions)
	assert.Empty(t, spec.Ingress[0].Ports)
}

func TestNodePortPolicyOpensOnlyTheTargetPortsOfItsPods(t *testing.T) {
	udp := corev1.ProtocolUDP
	services := []corev1.Service{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "postgres-nodeport", Namespace: "team-a"},
			Spec: corev1.ServiceSpec{
				Type:     corev1.ServiceTypeNodePort,
				Selector: map[string]string{"app.kubernetes.io/name": "postgres"},
				Ports: []corev1.ServicePort{
					{Port: 5432, TargetPort: intstr.FromInt32(5432), NodePort: 30001},
					{Port: 53, Protocol: udp, NodePort: 30002},
				},
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "no-selector", Namespace: "team-a"},
			Spec:       corev1.ServiceSpec{Type: corev1.ServiceTypeNodePort, Ports: []corev1.ServicePort{{Port: 80}}},
		},
	}

	policies := DesiredNetworkPolicies([]string{"team-a"}, services, nil)
	require.Equal(t, []string{"team-a/unbind-team-isolation", "team-a/unbind-nodeport-postgres-nodeport"}, policyNames(policies))

	spec := policies[1].Spec
	assert.Equal(t, map[string]string{"app.kubernetes.io/name": "postgres"}, spec.PodSelector.MatchLabels)
	require.Len(t, spec.Ingress, 1)
	assert.Empty(t, spec.Ingress[0].From)
	require.Len(t, spec.Ingress[0].Ports, 2)
	assert.Equal(t, intstr.FromInt32(5432), *spec.Ingress[0].Ports[0].Port)
	assert.Equal(t, corev1.ProtocolTCP, *spec.Ingress[0].Ports[0].Protocol)
	assert.Equal(t, intstr.FromInt32(53), *spec.Ingress[0].Ports[1].Port)
	assert.Equal(t, corev1.ProtocolUDP, *spec.Ingress[0].Ports[1].Protocol)
}

func TestExceptionPolicies(t *testing.T) {
	sourceID := uuid.New()
	targetID := uuid.New()
	fromService := NetworkException{ID: uuid.New(), SourceNamespace: "team-a", SourceServiceID: &sourceID, TargetNamespace: "team-b", TargetServiceID: targetID}
	fromAnywhere := NetworkException{ID: uuid.New(), TargetNamespace: "team-b", TargetServiceID: targetID}
	deletedTeam := NetworkException{ID: uuid.New(), TargetNamespace: "gone", TargetServiceID: targetID}

	policies := DesiredNetworkPolicies([]string{"team-a", "team-b"}, nil, []NetworkException{fromService, fromAnywhere, deletedTeam})
	require.Equal(t, []string{
		"team-a/unbind-team-isolation",
		"team-b/unbind-team-isolation",
		"team-b/unbind-exception-" + fromService.ID.String(),
		"team-b/unbind-exception-" + fromAnywhere.ID.String(),
	}, policyNames(policies))

	service := policies[2].Spec
	assert.Equal(t, map[string]string{"unbind-service": targetID.String()}, service.PodSelector.MatchLabels)
	require.Len(t, service.Ingress, 1)
	require.Len(t, service.Ingress[0].From, 1)
	assert.Equal(t, map[string]string{"kubernetes.io/metadata.name": "team-a"}, service.Ingress[0].From[0].NamespaceSelector.MatchLabels)
	assert.Equal(t, map[string]string{"unbind-service": sourceID.String()}, service.Ingress[0].From[0].PodSelector.MatchLabels)

	anywhere := policies[3].Spec
	require.Len(t, anywhere.Ingress, 1)
	assert.Empty(t, anywhere.Ingress[0].From)
	assert.Empty(t, anywhere.Ingress[0].Ports)
}

func newNetworkPolicyManagerForTest(t *testing.T, isolation bool, exceptions []*ent.NetworkException, objects ...any) (*NetworkPolicyManager, *fake.Clientset) {
	repo := mocks_repositories.NewRepositoriesMock(t)
	systemRepo := mocks_system_repo.NewSystemRepositoryMock(t)
	teamRepo := mocks_team_repo.NewTeamRepositoryMock(t)
	repo.EXPECT().Team().Return(teamRepo).Maybe()
	repo.EXPECT().System().Return(systemRepo).Maybe()
	teamRepo.EXPECT().GetAll(mock.Anything, mock.Anything).Return([]*ent.Team{{Namespace: "team-a"}, {Namespace: "team-b"}}, nil)
	systemRepo.EXPECT().GetSystemSettings(mock.Anything, mock.Anything).Return(&ent.SystemSetting{TeamNetworkIsolation: isolation}, nil)
	systemRepo.EXPECT().GetNetworkExceptions(mock.Anything).Return(exceptions, nil).Maybe()

	client := fake.NewClientset()
	for _, object := range objects {
		switch o := object.(type) {
		case *corev1.Namespace:
			_, err := client.CoreV1().Namespaces().Create(context.Background(), o, metav1.CreateOptions{})
			require.NoError(t, err)
		case *networkingv1.NetworkPolicy:
			_, err := client.NetworkingV1().NetworkPolicies(o.Namespace).Create(context.Background(), o, metav1.CreateOptions{})
			require.NoError(t, err)
		}
	}
	return NewNetworkPolicyManager(repo, client), client
}

func listPolicyNames(t *testing.T, client *fake.Clientset) []string {
	list, err := client.NetworkingV1().NetworkPolicies("").List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	return policyNames(list.Items)
}

func TestSyncLabelsTeamNamespacesAndReplacesStalePolicies(t *testing.T) {
	stale := networkPolicyMeta("unbind-exception-"+uuid.NewString(), "team-a", "exception")
	ownedByUser := metav1.ObjectMeta{Name: "user-policy", Namespace: "team-a"}
	manager, client := newNetworkPolicyManagerForTest(t, true, nil,
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-a"}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-b", Labels: map[string]string{TeamNamespaceLabel: "true"}}},
		&networkingv1.NetworkPolicy{ObjectMeta: stale},
		&networkingv1.NetworkPolicy{ObjectMeta: ownedByUser},
	)

	require.NoError(t, manager.Sync(context.Background()))

	namespace, err := client.CoreV1().Namespaces().Get(context.Background(), "team-a", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "true", namespace.Labels[TeamNamespaceLabel])
	assert.ElementsMatch(t, []string{"team-a/unbind-team-isolation", "team-b/unbind-team-isolation", "team-a/user-policy"}, listPolicyNames(t, client))
}

func TestSyncRestoresAnEditedPolicy(t *testing.T) {
	edited := teamIsolationPolicy("team-a")
	edited.Spec.Ingress = []networkingv1.NetworkPolicyIngressRule{{}}
	manager, client := newNetworkPolicyManagerForTest(t, true, nil,
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-a"}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-b"}},
		&edited,
	)

	require.NoError(t, manager.Sync(context.Background()))

	restored, err := client.NetworkingV1().NetworkPolicies("team-a").Get(context.Background(), teamIsolationPolicyName, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, teamIsolationPolicy("team-a").Spec, restored.Spec)
}

func TestSyncWithIsolationOffRemovesEveryManagedPolicy(t *testing.T) {
	isolation := teamIsolationPolicy("team-a")
	manager, client := newNetworkPolicyManagerForTest(t, false, nil,
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-a"}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-b"}},
		&isolation,
		&networkingv1.NetworkPolicy{ObjectMeta: metav1.ObjectMeta{Name: "user-policy", Namespace: "team-b"}},
	)

	require.NoError(t, manager.Sync(context.Background()))

	assert.Equal(t, []string{"team-b/user-policy"}, listPolicyNames(t, client))
}

func TestSyncResolvesExceptionNamespacesThroughTheServiceTeam(t *testing.T) {
	serviceInTeam := func(namespace string) *ent.Service {
		return &ent.Service{ID: uuid.New(), Edges: ent.ServiceEdges{Environment: &ent.Environment{Edges: ent.EnvironmentEdges{Project: &ent.Project{Edges: ent.ProjectEdges{Team: &ent.Team{Namespace: namespace}}}}}}}
	}
	source := serviceInTeam("team-a")
	target := serviceInTeam("team-b")
	exception := &ent.NetworkException{ID: uuid.New(), SourceServiceID: &source.ID, TargetServiceID: target.ID, Edges: ent.NetworkExceptionEdges{SourceService: source, TargetService: target}}
	manager, client := newNetworkPolicyManagerForTest(t, true, []*ent.NetworkException{exception},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-a"}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-b"}},
	)

	require.NoError(t, manager.Sync(context.Background()))

	policy, err := client.NetworkingV1().NetworkPolicies("team-b").Get(context.Background(), "unbind-exception-"+exception.ID.String(), metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"kubernetes.io/metadata.name": "team-a"}, policy.Spec.Ingress[0].From[0].NamespaceSelector.MatchLabels)
}
