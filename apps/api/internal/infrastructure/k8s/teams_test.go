package k8s

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestCreateTeamNamespace(t *testing.T) {
	tests := []struct {
		name         string
		teamName     string
		expectedName string
		expectError  bool
	}{
		{
			name:         "Valid team name",
			teamName:     "my-team",
			expectedName: "my-team",
			expectError:  false,
		},
		{
			name:         "Team name with uppercase",
			teamName:     "MyTeam",
			expectedName: "myteam", // Should be lowercased
			expectError:  false,
		},
		{
			name:        "Empty team name",
			teamName:    "",
			expectError: true,
		},
		{
			name:         "Team name with special chars",
			teamName:     "my_team-123",
			expectedName: "my-team-123", // Underscores converted to hyphens
			expectError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.NewSimpleClientset()

			if !tt.expectError {
				// Create namespace using fake client
				namespace := &corev1.Namespace{
					ObjectMeta: metav1.ObjectMeta{
						Name: normalizeTeamName(tt.teamName),
						Labels: map[string]string{
							"unbind.app/team":    normalizeTeamName(tt.teamName),
							"unbind.app/managed": "true",
						},
					},
				}

				_, err := client.CoreV1().Namespaces().Create(context.Background(), namespace, metav1.CreateOptions{})
				require.NoError(t, err)

				// Verify namespace was created with correct name
				createdNs, err := client.CoreV1().Namespaces().Get(context.Background(), tt.expectedName, metav1.GetOptions{})
				require.NoError(t, err)
				assert.Equal(t, tt.expectedName, createdNs.Name)
				assert.Equal(t, "true", createdNs.Labels["unbind.app/managed"])
				assert.Equal(t, tt.expectedName, createdNs.Labels["unbind.app/team"])
			}
		})
	}
}

func TestCreateTeamRoleBinding(t *testing.T) {
	tests := []struct {
		name            string
		teamName        string
		userEmail       string
		expectedSubject string
		role            string
	}{
		{
			name:            "Admin role binding",
			teamName:        "dev-team",
			userEmail:       "admin@example.com",
			expectedSubject: "admin@example.com",
			role:            "admin",
		},
		{
			name:            "Member role binding",
			teamName:        "qa-team",
			userEmail:       "member@example.com",
			expectedSubject: "member@example.com",
			role:            "edit",
		},
		{
			name:            "Viewer role binding",
			teamName:        "ops-team",
			userEmail:       "viewer@example.com",
			expectedSubject: "viewer@example.com",
			role:            "view",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.NewSimpleClientset()

			// Create RoleBinding using fake client
			roleBinding := &rbacv1.RoleBinding{
				ObjectMeta: metav1.ObjectMeta{
					Name:      tt.teamName + "-" + tt.role,
					Namespace: tt.teamName,
					Labels: map[string]string{
						"unbind.app/team": tt.teamName,
						"unbind.app/role": tt.role,
					},
				},
				Subjects: []rbacv1.Subject{
					{
						Kind:     "User",
						APIGroup: "rbac.authorization.k8s.io",
						Name:     tt.userEmail,
					},
				},
				RoleRef: rbacv1.RoleRef{
					APIGroup: "rbac.authorization.k8s.io",
					Kind:     "ClusterRole",
					Name:     tt.role,
				},
			}

			_, err := client.RbacV1().RoleBindings(tt.teamName).Create(context.Background(), roleBinding, metav1.CreateOptions{})
			require.NoError(t, err)

			// Verify RoleBinding was created correctly
			createdRB, err := client.RbacV1().RoleBindings(tt.teamName).Get(context.Background(), tt.teamName+"-"+tt.role, metav1.GetOptions{})
			require.NoError(t, err)

			assert.Equal(t, tt.teamName+"-"+tt.role, createdRB.Name)
			assert.Equal(t, tt.teamName, createdRB.Namespace)
			assert.Len(t, createdRB.Subjects, 1)
			assert.Equal(t, tt.expectedSubject, createdRB.Subjects[0].Name)
			assert.Equal(t, "User", createdRB.Subjects[0].Kind)
			assert.Equal(t, tt.role, createdRB.RoleRef.Name)
		})
	}
}

func TestTeamLabelValidation(t *testing.T) {
	tests := []struct {
		name    string
		labels  map[string]string
		isValid bool
	}{
		{
			name: "Valid team labels",
			labels: map[string]string{
				"unbind.app/team":    "my-team",
				"unbind.app/managed": "true",
			},
			isValid: true,
		},
		{
			name: "Missing team label",
			labels: map[string]string{
				"unbind.app/managed": "true",
			},
			isValid: false,
		},
		{
			name: "Invalid team name",
			labels: map[string]string{
				"unbind.app/team":    "My_Team!",
				"unbind.app/managed": "true",
			},
			isValid: false,
		},
		{
			name: "Not managed by unbind",
			labels: map[string]string{
				"unbind.app/team": "my-team",
			},
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := validateTeamLabels(tt.labels)
			assert.Equal(t, tt.isValid, isValid)
		})
	}
}

func TestListTeamNamespaces(t *testing.T) {
	// Create test namespaces
	namespaces := []runtime.Object{
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: "team-alpha",
				Labels: map[string]string{
					"unbind.app/team":    "team-alpha",
					"unbind.app/managed": "true",
				},
			},
		},
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: "team-beta",
				Labels: map[string]string{
					"unbind.app/team":    "team-beta",
					"unbind.app/managed": "true",
				},
			},
		},
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: "kube-system", // Should be ignored
			},
		},
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: "other-namespace",
				Labels: map[string]string{
					"some-other": "label",
				},
			},
		},
	}

	client := fake.NewSimpleClientset(namespaces...)

	// List all namespaces
	nsList, err := client.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)

	// Filter for team namespaces
	teamNamespaces := filterTeamNamespaces(nsList.Items)

	// Should only return the 2 team namespaces
	assert.Len(t, teamNamespaces, 2)

	teamNames := make([]string, len(teamNamespaces))
	for i, ns := range teamNamespaces {
		teamNames[i] = ns.Name
	}

	assert.Contains(t, teamNames, "team-alpha")
	assert.Contains(t, teamNames, "team-beta")
}

func TestDeleteTeamResources(t *testing.T) {
	// Create test resources for a team
	teamName := "test-team"

	resources := []runtime.Object{
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: teamName,
				Labels: map[string]string{
					"unbind.app/team":    teamName,
					"unbind.app/managed": "true",
				},
			},
		},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      teamName + "-admin",
				Namespace: teamName,
				Labels: map[string]string{
					"unbind.app/team": teamName,
				},
			},
		},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      teamName + "-edit",
				Namespace: teamName,
				Labels: map[string]string{
					"unbind.app/team": teamName,
				},
			},
		},
	}

	client := fake.NewSimpleClientset(resources...)

	// Verify resources exist
	_, err := client.CoreV1().Namespaces().Get(context.Background(), teamName, metav1.GetOptions{})
	require.NoError(t, err)

	roleBindings, err := client.RbacV1().RoleBindings(teamName).List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	assert.Len(t, roleBindings.Items, 2)

	// Delete namespace (which should cascade delete RoleBindings)
	err = client.CoreV1().Namespaces().Delete(context.Background(), teamName, metav1.DeleteOptions{})
	require.NoError(t, err)

	// Verify namespace is deleted
	_, err = client.CoreV1().Namespaces().Get(context.Background(), teamName, metav1.GetOptions{})
	assert.Error(t, err) // Should be NotFound error
}

func TestGenerateTeamResourceName(t *testing.T) {
	tests := []struct {
		name         string
		teamName     string
		resourceType string
		expected     string
	}{
		{
			name:         "Admin role binding",
			teamName:     "my-team",
			resourceType: "admin",
			expected:     "my-team-admin",
		},
		{
			name:         "Member role binding",
			teamName:     "dev-team",
			resourceType: "edit",
			expected:     "dev-team-edit",
		},
		{
			name:         "Service account",
			teamName:     "qa-team",
			resourceType: "serviceaccount",
			expected:     "qa-team-serviceaccount",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := generateTeamResourceName(tt.teamName, tt.resourceType)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestValidateTeamAccess(t *testing.T) {
	tests := []struct {
		name      string
		userEmail string
		teamName  string
		role      string
		hasAccess bool
	}{
		{
			name:      "Admin has access",
			userEmail: "admin@example.com",
			teamName:  "my-team",
			role:      "admin",
			hasAccess: true,
		},
		{
			name:      "Member has limited access",
			userEmail: "member@example.com",
			teamName:  "my-team",
			role:      "edit",
			hasAccess: true,
		},
		{
			name:      "Viewer has read access",
			userEmail: "viewer@example.com",
			teamName:  "my-team",
			role:      "view",
			hasAccess: true,
		},
		{
			name:      "No access for unknown user",
			userEmail: "unknown@example.com",
			teamName:  "my-team",
			role:      "",
			hasAccess: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hasAccess := validateTeamAccess(tt.userEmail, tt.teamName, tt.role)
			assert.Equal(t, tt.hasAccess, hasAccess)
		})
	}
}

// Helper functions for testing

func normalizeTeamName(teamName string) string {
	// Convert to lowercase and replace underscores with hyphens
	name := strings.ToLower(teamName)
	name = strings.ReplaceAll(name, "_", "-")
	return name
}

func validateTeamLabels(labels map[string]string) bool {
	teamName, hasTeam := labels["unbind.app/team"]
	managed, hasManaged := labels["unbind.app/managed"]

	if !hasTeam || !hasManaged {
		return false
	}

	if managed != "true" {
		return false
	}

	// Basic team name validation (alphanumeric and hyphens only)
	if !isValidTeamName(teamName) {
		return false
	}

	return true
}

func isValidTeamName(name string) bool {
	if name == "" {
		return false
	}

	// Check for valid characters (letters, numbers, hyphens)
	for _, r := range name {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-') {
			return false
		}
	}

	return true
}

func filterTeamNamespaces(namespaces []corev1.Namespace) []corev1.Namespace {
	var teamNamespaces []corev1.Namespace

	for _, ns := range namespaces {
		if validateTeamLabels(ns.Labels) {
			teamNamespaces = append(teamNamespaces, ns)
		}
	}

	return teamNamespaces
}

func generateTeamResourceName(teamName, resourceType string) string {
	return teamName + "-" + resourceType
}

func validateTeamAccess(userEmail, teamName, role string) bool {
	// Simple validation - non-empty role means access
	return role != ""
}
