package k8s

import (
	"context"
	"fmt"

	"github.com/unbindapp/unbind-api/ent"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// RBACManager integrates unbind groups with Kubernetes RBAC.
type RBACManager struct {
	repo       repositories.RepositoriesInterface
	kubeClient *KubeClient
}

func NewRBACManager(repository repositories.RepositoriesInterface, kubeClient *KubeClient) *RBACManager {
	return &RBACManager{
		repo:       repository,
		kubeClient: kubeClient,
	}
}

// SyncGroupToK8s creates or updates Kubernetes RBAC resources for a group, must have permissions edge populated
func (self *RBACManager) SyncGroupToK8s(ctx context.Context, group *ent.Group) error {
	roleName, bindingName := getRoleAndBindingName(group.Name, group.ID.String())

	var err error
	// Create or update Role for each permission
	for _, permission := range group.Edges.Permissions {
		// Get teams
		teams := []*ent.Team{}
		if permission.ResourceSelector.Superuser {
			// get all teams
			teams, err = self.repo.Team().GetAll(ctx, nil)
			if err != nil {
				return fmt.Errorf("failed to get all teams: %w", err)
			}
		} else {
			// Get team by ID
			team, err := self.repo.Team().GetByID(ctx, permission.ResourceSelector.ID)
			if err != nil {
				return err
			}
			teams = append(teams, team)
		}

		for _, team := range teams {
			// Create or update the Role
			if err := self.createOrUpdateRole(ctx, roleName, team.Namespace, group.Name, permission.Action); err != nil {
				log.Warnf("Warning: failed to create/update Role for group %s in namespace %s: %v", group.Name, team.Namespace, err)
				continue
			}

			// Create or update the RoleBinding
			if err := self.createOrUpdateRoleBinding(ctx, roleName, bindingName, team.Namespace, group.Name); err != nil {
				log.Warnf("Warning: failed to create/update RoleBinding for group %s in namespace %s: %v", group.Name, team.Namespace, err)
				continue
			}
		}
	}

	// Update the group in our database to store K8s reference
	err = self.repo.Group().UpdateK8sRoleName(ctx, group, roleName)
	if err != nil {
		return fmt.Errorf("failed to update group: %w", err)
	}

	return nil
}

// createOrUpdateRole creates or updates a Role for the given group in the specified namespace
func (self *RBACManager) createOrUpdateRole(ctx context.Context, roleName, namespace, grroupName string, permittedAction entSchema.PermittedAction) error {
	// Determine verbs based on access level
	var verbs []string
	switch permittedAction {
	case entSchema.ActionAdmin:
		verbs = []string{"get", "list", "watch", "create", "update", "patch", "delete"}
	case entSchema.ActionEditor:
		verbs = []string{"get", "list", "watch", "create", "update", "patch"}
	default: // view
		verbs = []string{"get", "list", "watch"}
	}

	// Common resources to access
	resources := []string{
		// Core workload resources
		"pods", "services", "deployments", "statefulsets",
		"replicasets", "daemonsets", "jobs", "cronjobs",

		// Configuration resources
		"configmaps", "secrets",

		// Storage resources
		"persistentvolumeclaims",

		// Networking resources
		"ingresses", "networkpolicies", "services",

		// Observability resources
		"events", "endpoints", "pods/log",
	}

	// Build rules for the Role
	var rules []any

	// Core API group ("") resources
	if len(filterResourcesByAPIGroup(resources, "")) > 0 {
		rules = append(rules, map[string]any{
			"apiGroups": []any{""},
			"resources": interfaceFromStrings(filterResourcesByAPIGroup(resources, "")),
			"verbs":     interfaceFromStrings(verbs),
		})
	}

	// Apps API group resources
	if len(filterResourcesByAPIGroup(resources, "apps")) > 0 {
		rules = append(rules, map[string]any{
			"apiGroups": []any{"apps"},
			"resources": interfaceFromStrings(filterResourcesByAPIGroup(resources, "apps")),
			"verbs":     interfaceFromStrings(verbs),
		})
	}

	// Batch API group resources
	if len(filterResourcesByAPIGroup(resources, "batch")) > 0 {
		rules = append(rules, map[string]any{
			"apiGroups": []any{"batch"},
			"resources": interfaceFromStrings(filterResourcesByAPIGroup(resources, "batch")),
			"verbs":     interfaceFromStrings(verbs),
		})
	}

	// Networking API group resources
	if len(filterResourcesByAPIGroup(resources, "networking.k8s.io")) > 0 {
		rules = append(rules, map[string]any{
			"apiGroups": []any{"networking.k8s.io"},
			"resources": interfaceFromStrings(filterResourcesByAPIGroup(resources, "networking.k8s.io")),
			"verbs":     interfaceFromStrings(verbs),
		})
	}

	// Define the Role
	role := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "rbac.authorization.k8s.io/v1",
			"kind":       "Role",
			"metadata": map[string]any{
				"name":      roleName,
				"namespace": namespace,
				"labels": map[string]any{
					"app.kubernetes.io/managed-by": "unbind",
					"unbind.app/group-name":        grroupName,
				},
			},
			"rules": rules,
		},
	}

	// Define the resource schema for Roles
	roleResource := schema.GroupVersionResource{
		Group:    "rbac.authorization.k8s.io",
		Version:  "v1",
		Resource: "roles",
	}

	// Try to get existing Role
	_, err := self.kubeClient.client.Resource(roleResource).Namespace(namespace).Get(ctx, roleName, metav1.GetOptions{})
	if err == nil {
		// Update the existing Role
		_, err = self.kubeClient.client.Resource(roleResource).Namespace(namespace).Update(ctx, role, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update Role: %w", err)
		}
		log.Infof("Role '%s' in namespace '%s' updated successfully", roleName, namespace)
	} else {
		// Create a new Role
		_, err = self.kubeClient.client.Resource(roleResource).Namespace(namespace).Create(ctx, role, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create Role: %w", err)
		}
		log.Infof("Role '%s' in namespace '%s' created successfully", roleName, namespace)
	}

	return nil
}

// Helper function to filter resources by API group
func filterResourcesByAPIGroup(resources []string, apiGroup string) []string {
	var filteredResources []string

	switch apiGroup {
	case "": // Core API group
		coreResources := []string{
			"pods", "services", "configmaps", "secrets",
			"persistentvolumeclaims", "events", "endpoints",
			"namespaces", "pods/log",
		}
		for _, r := range resources {
			for _, cr := range coreResources {
				if r == cr {
					filteredResources = append(filteredResources, r)
					break
				}
			}
		}
	case "apps":
		appsResources := []string{
			"deployments", "statefulsets", "replicasets", "daemonsets",
		}
		for _, r := range resources {
			for _, ar := range appsResources {
				if r == ar {
					filteredResources = append(filteredResources, r)
					break
				}
			}
		}
	case "batch":
		batchResources := []string{
			"jobs", "cronjobs",
		}
		for _, r := range resources {
			for _, br := range batchResources {
				if r == br {
					filteredResources = append(filteredResources, r)
					break
				}
			}
		}
	case "networking.k8s.io":
		networkingResources := []string{
			"ingresses", "networkpolicies", "ingressclasses",
		}
		for _, r := range resources {
			for _, nr := range networkingResources {
				if r == nr {
					filteredResources = append(filteredResources, r)
					break
				}
			}
		}
	}

	return filteredResources
}

// createOrUpdateRoleBinding creates or updates a RoleBinding for the given group in the specified namespace
func (self *RBACManager) createOrUpdateRoleBinding(ctx context.Context, roleName, bindingName, namespace, groupName string) error {
	// Define the RoleBinding
	rb := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "rbac.authorization.k8s.io/v1",
			"kind":       "RoleBinding",
			"metadata": map[string]any{
				"name":      bindingName,
				"namespace": namespace,
				"labels": map[string]any{
					"app.kubernetes.io/managed-by": "unbind",
					"unbind.app/group-name":        groupName,
				},
			},
			"subjects": []any{
				map[string]any{
					"kind":     "Group",
					"name":     "oidc:" + groupName,
					"apiGroup": "rbac.authorization.k8s.io",
				},
			},
			"roleRef": map[string]any{
				"kind":     "Role",
				"name":     roleName,
				"apiGroup": "rbac.authorization.k8s.io",
			},
		},
	}

	// Define the resource schema for RoleBindings
	rbResource := schema.GroupVersionResource{
		Group:    "rbac.authorization.k8s.io",
		Version:  "v1",
		Resource: "rolebindings",
	}

	// Try to get existing RoleBinding
	_, err := self.kubeClient.client.Resource(rbResource).Namespace(namespace).Get(ctx, bindingName, metav1.GetOptions{})
	if err == nil {
		// Update the existing RoleBinding
		_, err = self.kubeClient.client.Resource(rbResource).Namespace(namespace).Update(ctx, rb, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update RoleBinding: %w", err)
		}
		log.Infof("RoleBinding '%s' in namespace '%s' updated successfully", bindingName, namespace)
	} else {
		// Create a new RoleBinding
		_, err = self.kubeClient.client.Resource(rbResource).Namespace(namespace).Create(ctx, rb, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create RoleBinding: %w", err)
		}
		log.Infof("RoleBinding '%s' in namespace '%s' created successfully", bindingName, namespace)
	}

	return nil
}

// SyncAllGroups synchronizes all groups with Kubernetes RBAC
func (self *RBACManager) SyncAllGroups(ctx context.Context) error {
	groups, err := self.repo.Group().GetAllWithPermissions(ctx)
	if err != nil {
		return fmt.Errorf("failed to query groups: %w", err)
	}

	for _, group := range groups {
		// Determine if this group should have K8s access
		hasK8sAccess := false
		for _, p := range group.Edges.Permissions {
			// ! Only managing teams this way
			if p.ResourceType == entSchema.ResourceTypeTeam {
				hasK8sAccess = true
				break
			}
		}

		if hasK8sAccess {
			// Sync the group to K8s
			if err := self.SyncGroupToK8s(ctx, group); err != nil {
				log.Warnf("Warning: failed to sync group %s to K8s: %v", group.Name, err)
			}
		} else if group.K8sRoleName != nil {
			// Group no longer has K8s access but did before, remove it
			if err := self.DeleteK8sRBAC(ctx, group); err != nil {
				log.Warnf("Warning: failed to delete K8s RBAC for group %s: %v", group.Name, err)
			}
		}
	}

	return nil
}

// DeleteK8sRBAC removes Kubernetes RBAC resources for a group
func (self *RBACManager) DeleteK8sRBAC(ctx context.Context, group *ent.Group) error {
	// Check if the group has a K8s role name
	if group.K8sRoleName == nil {
		return nil // Nothing to delete
	}

	// Get teams
	teams := []*ent.Team{}
	var err error
	for _, permission := range group.Edges.Permissions {
		// Get teams
		if permission.ResourceSelector.Superuser {
			// get all teams
			teams, err = self.repo.Team().GetAll(ctx, nil)
			if err != nil {
				return fmt.Errorf("failed to get all teams: %w", err)
			}
		} else {
			// Get team by ID
			team, err := self.repo.Team().GetByID(ctx, permission.ResourceSelector.ID)
			if err != nil {
				return err
			}
			teams = append(teams, team)
		}
	}

	// Define the resource schemas
	roleResource := schema.GroupVersionResource{
		Group:    "rbac.authorization.k8s.io",
		Version:  "v1",
		Resource: "roles",
	}

	rbResource := schema.GroupVersionResource{
		Group:    "rbac.authorization.k8s.io",
		Version:  "v1",
		Resource: "rolebindings",
	}

	roleName, bindingName := getRoleAndBindingName(group.Name, group.ID.String())

	// For each team, try to delete the Role and RoleBinding
	for _, team := range teams {
		// Delete the RoleBinding first
		err = self.kubeClient.client.Resource(rbResource).Namespace(team.Namespace).Delete(ctx, bindingName, metav1.DeleteOptions{})
		if err == nil {
			log.Infof("RoleBinding '%s' in namespace '%s' deleted successfully", bindingName, team.Namespace)
		}

		// Delete the Role
		err = self.kubeClient.client.Resource(roleResource).Namespace(team.Namespace).Delete(ctx, roleName, metav1.DeleteOptions{})
		if err == nil {
			log.Infof("Role '%s' in namespace '%s' deleted successfully", roleName, team.Namespace)
		}
	}

	// Update the group in our database to remove K8s reference
	err = self.repo.Group().ClearK8sRoleName(ctx, group)

	return err
}

// Helper function to convert a string slice to an interface slice
func interfaceFromStrings(strings []string) []any {
	interfaces := make([]any, len(strings))
	for i, s := range strings {
		interfaces[i] = s
	}
	return interfaces
}

// Helper to get role and binding name
func getRoleAndBindingName(groupName string, groupID string) (string, string) {
	roleName := fmt.Sprintf("unbind-group-%s-%s", groupName, groupID)
	bindingName := fmt.Sprintf("binding-%s", roleName)
	return roleName, bindingName
}
