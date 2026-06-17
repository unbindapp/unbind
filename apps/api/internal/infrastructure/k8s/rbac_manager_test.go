package k8s

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestCreateRole(t *testing.T) {
	client := fake.NewSimpleClientset()

	role := &rbacv1.Role{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-role",
			Namespace: "default",
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "unbind",
				"unbind.app/component":         "rbac",
			},
		},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups: []string{""},
				Resources: []string{"pods", "services"},
				Verbs:     []string{"get", "list", "watch"},
			},
			{
				APIGroups: []string{"apps"},
				Resources: []string{"deployments"},
				Verbs:     []string{"get", "list", "watch", "create", "update", "patch", "delete"},
			},
		},
	}

	// Create role
	createdRole, err := client.RbacV1().Roles("default").Create(context.Background(), role, metav1.CreateOptions{})
	require.NoError(t, err)

	// Verify role was created correctly
	assert.Equal(t, "test-role", createdRole.Name)
	assert.Equal(t, "default", createdRole.Namespace)
	assert.Equal(t, "unbind", createdRole.Labels["app.kubernetes.io/managed-by"])
	assert.Len(t, createdRole.Rules, 2)

	// Verify first rule
	rule1 := createdRole.Rules[0]
	assert.Equal(t, []string{""}, rule1.APIGroups)
	assert.Equal(t, []string{"pods", "services"}, rule1.Resources)
	assert.Equal(t, []string{"get", "list", "watch"}, rule1.Verbs)

	// Verify second rule
	rule2 := createdRole.Rules[1]
	assert.Equal(t, []string{"apps"}, rule2.APIGroups)
	assert.Equal(t, []string{"deployments"}, rule2.Resources)
	assert.Contains(t, rule2.Verbs, "create")
	assert.Contains(t, rule2.Verbs, "delete")
}

func TestCreateRoleBinding(t *testing.T) {
	client := fake.NewSimpleClientset()

	roleBinding := &rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-role-binding",
			Namespace: "default",
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "unbind",
				"unbind.app/component":         "rbac",
			},
		},
		Subjects: []rbacv1.Subject{
			{
				Kind:      "ServiceAccount",
				Name:      "test-service-account",
				Namespace: "default",
			},
			{
				Kind:     "User",
				Name:     "test-user",
				APIGroup: "rbac.authorization.k8s.io",
			},
		},
		RoleRef: rbacv1.RoleRef{
			Kind:     "Role",
			Name:     "test-role",
			APIGroup: "rbac.authorization.k8s.io",
		},
	}

	// Create role binding
	createdRoleBinding, err := client.RbacV1().RoleBindings("default").Create(context.Background(), roleBinding, metav1.CreateOptions{})
	require.NoError(t, err)

	// Verify role binding was created correctly
	assert.Equal(t, "test-role-binding", createdRoleBinding.Name)
	assert.Equal(t, "default", createdRoleBinding.Namespace)
	assert.Equal(t, "unbind", createdRoleBinding.Labels["app.kubernetes.io/managed-by"])
	assert.Len(t, createdRoleBinding.Subjects, 2)

	// Verify subjects
	serviceAccount := createdRoleBinding.Subjects[0]
	assert.Equal(t, "ServiceAccount", serviceAccount.Kind)
	assert.Equal(t, "test-service-account", serviceAccount.Name)
	assert.Equal(t, "default", serviceAccount.Namespace)

	user := createdRoleBinding.Subjects[1]
	assert.Equal(t, "User", user.Kind)
	assert.Equal(t, "test-user", user.Name)
	assert.Equal(t, "rbac.authorization.k8s.io", user.APIGroup)

	// Verify role reference
	assert.Equal(t, "Role", createdRoleBinding.RoleRef.Kind)
	assert.Equal(t, "test-role", createdRoleBinding.RoleRef.Name)
	assert.Equal(t, "rbac.authorization.k8s.io", createdRoleBinding.RoleRef.APIGroup)
}

func TestCreateClusterRole(t *testing.T) {
	client := fake.NewSimpleClientset()

	clusterRole := &rbacv1.ClusterRole{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-cluster-role",
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "unbind",
				"unbind.app/component":         "rbac",
			},
		},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups: []string{""},
				Resources: []string{"nodes", "persistentvolumes"},
				Verbs:     []string{"get", "list", "watch"},
			},
			{
				APIGroups: []string{"storage.k8s.io"},
				Resources: []string{"storageclasses"},
				Verbs:     []string{"get", "list"},
			},
		},
	}

	// Create cluster role
	createdClusterRole, err := client.RbacV1().ClusterRoles().Create(context.Background(), clusterRole, metav1.CreateOptions{})
	require.NoError(t, err)

	// Verify cluster role was created correctly
	assert.Equal(t, "test-cluster-role", createdClusterRole.Name)
	assert.Equal(t, "unbind", createdClusterRole.Labels["app.kubernetes.io/managed-by"])
	assert.Len(t, createdClusterRole.Rules, 2)

	// Verify cluster-scoped resources rule
	rule1 := createdClusterRole.Rules[0]
	assert.Equal(t, []string{""}, rule1.APIGroups)
	assert.Equal(t, []string{"nodes", "persistentvolumes"}, rule1.Resources)
	assert.Equal(t, []string{"get", "list", "watch"}, rule1.Verbs)

	// Verify storage rule
	rule2 := createdClusterRole.Rules[1]
	assert.Equal(t, []string{"storage.k8s.io"}, rule2.APIGroups)
	assert.Equal(t, []string{"storageclasses"}, rule2.Resources)
	assert.Equal(t, []string{"get", "list"}, rule2.Verbs)
}

func TestCreateClusterRoleBinding(t *testing.T) {
	client := fake.NewSimpleClientset()

	clusterRoleBinding := &rbacv1.ClusterRoleBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-cluster-role-binding",
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "unbind",
				"unbind.app/component":         "rbac",
			},
		},
		Subjects: []rbacv1.Subject{
			{
				Kind:      "ServiceAccount",
				Name:      "cluster-service-account",
				Namespace: "kube-system",
			},
		},
		RoleRef: rbacv1.RoleRef{
			Kind:     "ClusterRole",
			Name:     "test-cluster-role",
			APIGroup: "rbac.authorization.k8s.io",
		},
	}

	// Create cluster role binding
	createdClusterRoleBinding, err := client.RbacV1().ClusterRoleBindings().Create(context.Background(), clusterRoleBinding, metav1.CreateOptions{})
	require.NoError(t, err)

	// Verify cluster role binding was created correctly
	assert.Equal(t, "test-cluster-role-binding", createdClusterRoleBinding.Name)
	assert.Equal(t, "unbind", createdClusterRoleBinding.Labels["app.kubernetes.io/managed-by"])
	assert.Len(t, createdClusterRoleBinding.Subjects, 1)

	// Verify subject
	subject := createdClusterRoleBinding.Subjects[0]
	assert.Equal(t, "ServiceAccount", subject.Kind)
	assert.Equal(t, "cluster-service-account", subject.Name)
	assert.Equal(t, "kube-system", subject.Namespace)

	// Verify cluster role reference
	assert.Equal(t, "ClusterRole", createdClusterRoleBinding.RoleRef.Kind)
	assert.Equal(t, "test-cluster-role", createdClusterRoleBinding.RoleRef.Name)
	assert.Equal(t, "rbac.authorization.k8s.io", createdClusterRoleBinding.RoleRef.APIGroup)
}

func TestRBACValidation(t *testing.T) {
	tests := []struct {
		name     string
		rule     rbacv1.PolicyRule
		isValid  bool
		errorMsg string
	}{
		{
			name: "Valid rule with core API",
			rule: rbacv1.PolicyRule{
				APIGroups: []string{""},
				Resources: []string{"pods"},
				Verbs:     []string{"get", "list"},
			},
			isValid: true,
		},
		{
			name: "Valid rule with apps API",
			rule: rbacv1.PolicyRule{
				APIGroups: []string{"apps"},
				Resources: []string{"deployments"},
				Verbs:     []string{"create", "update", "delete"},
			},
			isValid: true,
		},
		{
			name: "Invalid rule with empty verbs",
			rule: rbacv1.PolicyRule{
				APIGroups: []string{""},
				Resources: []string{"pods"},
				Verbs:     []string{},
			},
			isValid:  false,
			errorMsg: "verbs cannot be empty",
		},
		{
			name: "Invalid rule with empty resources",
			rule: rbacv1.PolicyRule{
				APIGroups: []string{""},
				Resources: []string{},
				Verbs:     []string{"get"},
			},
			isValid:  false,
			errorMsg: "resources cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePolicyRule(tt.rule)

			if tt.isValid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			}
		})
	}
}

func TestRBACSubjectValidation(t *testing.T) {
	tests := []struct {
		name    string
		subject rbacv1.Subject
		isValid bool
	}{
		{
			name: "Valid ServiceAccount subject",
			subject: rbacv1.Subject{
				Kind:      "ServiceAccount",
				Name:      "test-sa",
				Namespace: "default",
			},
			isValid: true,
		},
		{
			name: "Valid User subject",
			subject: rbacv1.Subject{
				Kind:     "User",
				Name:     "test-user",
				APIGroup: "rbac.authorization.k8s.io",
			},
			isValid: true,
		},
		{
			name: "Valid Group subject",
			subject: rbacv1.Subject{
				Kind:     "Group",
				Name:     "test-group",
				APIGroup: "rbac.authorization.k8s.io",
			},
			isValid: true,
		},
		{
			name: "Invalid subject with empty name",
			subject: rbacv1.Subject{
				Kind: "User",
				Name: "",
			},
			isValid: false,
		},
		{
			name: "Invalid subject with unknown kind",
			subject: rbacv1.Subject{
				Kind: "UnknownKind",
				Name: "test",
			},
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := validateSubject(tt.subject)
			assert.Equal(t, tt.isValid, isValid)
		})
	}
}

func TestGetRolesByLabels(t *testing.T) {
	// Create test roles
	roles := []runtime.Object{
		&rbacv1.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "managed-role-1",
				Namespace: "default",
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "unbind",
					"component":                    "api",
				},
			},
		},
		&rbacv1.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "managed-role-2",
				Namespace: "default",
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "unbind",
					"component":                    "worker",
				},
			},
		},
		&rbacv1.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "external-role",
				Namespace: "default",
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "helm",
				},
			},
		},
	}

	client := fake.NewSimpleClientset(roles...)

	// Test filtering by managed-by label
	roleList, err := client.RbacV1().Roles("default").List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)

	unbindRoles := filterRolesByLabel(roleList.Items, "app.kubernetes.io/managed-by", "unbind")
	assert.Len(t, unbindRoles, 2)

	// Test filtering by component
	apiRoles := filterRolesByLabel(roleList.Items, "component", "api")
	assert.Len(t, apiRoles, 1)
	assert.Equal(t, "managed-role-1", apiRoles[0].Name)
}

func TestRoleBindingDeletionHandling(t *testing.T) {
	roleBindingName := "test-role-binding"
	namespace := "default"

	// Create a role binding
	roleBinding := &rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name:      roleBindingName,
			Namespace: namespace,
			Finalizers: []string{
				"rbac.authorization.k8s.io/role-binding-finalizer",
			},
		},
		RoleRef: rbacv1.RoleRef{
			Kind:     "Role",
			Name:     "test-role",
			APIGroup: "rbac.authorization.k8s.io",
		},
	}

	client := fake.NewSimpleClientset(roleBinding)

	// Verify role binding exists
	_, err := client.RbacV1().RoleBindings(namespace).Get(context.Background(), roleBindingName, metav1.GetOptions{})
	require.NoError(t, err)

	// Test that role binding has finalizer
	assert.Contains(t, roleBinding.Finalizers, "rbac.authorization.k8s.io/role-binding-finalizer")

	// Delete role binding
	err = client.RbacV1().RoleBindings(namespace).Delete(context.Background(), roleBindingName, metav1.DeleteOptions{})
	require.NoError(t, err)

	// In fake client, it's immediately deleted (unlike real cluster)
	_, err = client.RbacV1().RoleBindings(namespace).Get(context.Background(), roleBindingName, metav1.GetOptions{})
	assert.Error(t, err) // Should be NotFound
}

// Helper functions for testing

func validatePolicyRule(rule rbacv1.PolicyRule) error {
	if len(rule.Verbs) == 0 {
		return fmt.Errorf("verbs cannot be empty")
	}

	if len(rule.Resources) == 0 {
		return fmt.Errorf("resources cannot be empty")
	}

	return nil
}

func validateSubject(subject rbacv1.Subject) bool {
	if subject.Name == "" {
		return false
	}

	validKinds := []string{"ServiceAccount", "User", "Group"}
	for _, kind := range validKinds {
		if subject.Kind == kind {
			return true
		}
	}

	return false
}

func filterRolesByLabel(roles []rbacv1.Role, labelKey, labelValue string) []rbacv1.Role {
	var filtered []rbacv1.Role

	for _, role := range roles {
		if value, exists := role.Labels[labelKey]; exists && value == labelValue {
			filtered = append(filtered, role)
		}
	}

	return filtered
}
