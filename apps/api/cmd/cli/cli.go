package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/project"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/team"
	"github.com/unbindapp/unbind-api/ent/user"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/database"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	group_service "github.com/unbindapp/unbind-api/internal/services/group"
	"golang.org/x/crypto/bcrypt"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var Version = "development"

type cli struct {
	cfg          *config.Config
	repository   repositories.RepositoriesInterface
	groupService *group_service.GroupService
	rbacManager  *k8s.RBACManager
	k8s          *k8s.KubeClient
}

func NewCLI(cfg *config.Config) *cli {
	// Load database
	dbConnInfo, err := database.GetSqlDbConn(cfg, false)
	if err != nil {
		log.Fatalf("Failed to get database connection info: %v", err)
	}
	// Initialize ent client
	db, _, err := database.NewEntClient(dbConnInfo)
	if err != nil {
		log.Fatalf("Failed to create ent client: %v", err)
	}
	repo := repositories.NewRepositories(db)

	kubeClient := k8s.NewKubeClient(cfg, repo)
	rbacManager := k8s.NewRBACManager(repo, kubeClient)

	return &cli{
		cfg:        cfg,
		repository: repo,
		groupService: group_service.NewGroupService(
			repo,
			rbacManager,
		),
		rbacManager: rbacManager,
		k8s:         kubeClient,
	}
}

// List version
func (self *cli) version() {
	fmt.Println("Unbind version:", Version)
}

// List all users in the database
func (self *cli) listUsers() {
	// Query all users
	users, err := self.repository.Ent().User.Query().WithGroups().All(context.Background())
	if err != nil {
		fmt.Printf("Error querying users: %v\n", err)
		return
	}

	// Print user information
	fmt.Println("Users:")
	fmt.Println("-------------------------------------")
	for _, u := range users {
		groupNames := make([]string, len(u.Edges.Groups))
		for i, g := range u.Edges.Groups {
			groupNames[i] = g.Name
		}
		fmt.Printf("ID: %s\n", u.ID)
		fmt.Printf("Email: %s\n", u.Email)
		fmt.Printf("Created: %s\n", u.CreatedAt.Format(time.RFC3339))
		fmt.Printf("Groups: %s\n", strings.Join(groupNames, ", "))
		fmt.Println("-------------------------------------")
	}
	fmt.Printf("Total users: %d\n", len(users))
}

// List all groups in the database
func (self *cli) listGroups() {
	ctx := context.Background()

	// Query all groups
	groups, err := self.repository.Ent().Group.Query().All(ctx)
	if err != nil {
		fmt.Printf("Error querying groups: %v\n", err)
		return
	}

	// Print group information
	fmt.Println("Groups:")
	fmt.Println("-------------------------------------")
	for _, g := range groups {
		fmt.Printf("ID: %s\n", g.ID)
		fmt.Printf("Name: %s\n", g.Name)
		fmt.Printf("Description: %s\n", g.Description)

		if g.K8sRoleName != nil {
			fmt.Printf("K8s Role: %s\n", *g.K8sRoleName)
		}

		// Get members count
		members, err := self.repository.Ent().Group.QueryUsers(g).Count(ctx)
		if err != nil {
			fmt.Printf("Error counting members: %v\n", err)
		} else {
			fmt.Printf("Members: %d\n", members)
		}

		// Get permissions count
		perms, err := self.repository.Ent().Group.QueryPermissions(g).Count(ctx)
		if err != nil {
			fmt.Printf("Error counting permissions: %v\n", err)
		} else {
			fmt.Printf("Permissions: %d\n", perms)
		}

		fmt.Println("-------------------------------------")
	}
	fmt.Printf("Total groups: %d\n", len(groups))
}

// Create a new team
func (self *cli) createTeam(name, displayName string) {
	ctx := context.Background()

	// Validate inputs
	if name == "" {
		log.Errorf("Error: name is required")
		return
	}

	if displayName == "" {
		displayName = name
	}

	// Check if team
	exists, err := self.repository.Ent().Team.Query().
		Where(team.KubernetesNameEQ(name)).
		Exist(ctx)
	if err != nil {
		log.Errorf("Error checking if team exists: %v", err)
		return
	}
	if exists {
		log.Errorf("Error: Team '%s' already exists", name)
		return
	}

	kubeConfig, err := rest.InClusterConfig()
	if err != nil {
		log.Fatalf("Error getting in-cluster config: %v", err)
	}
	client, err := kubernetes.NewForConfig(kubeConfig)
	if err != nil {
		log.Fatalf("Error creating clientset: %v", err)
	}

	// Create the team
	var team *ent.Team
	if err := self.repository.WithTx(ctx, func(tx repository.TxInterface) error {
		db := tx.Client()
		// Create secret to associate with the name
		secret, _, err := self.k8s.GetOrCreateSecret(ctx, name, strings.ToLower(name), client)
		if err != nil {
			return fmt.Errorf("error creating secret: %v", err)
		}
		var createErr error
		team, createErr = db.Team.Create().
			SetKubernetesName(name).
			SetName(displayName).
			SetNamespace(strings.ToLower(name)).
			SetKubernetesSecret(secret.Name).Save(ctx)

		return createErr
	}); err != nil {
		fmt.Printf("Error creating team: %v\n", err)
		return
	}

	fmt.Println("Team created successfully:")
	fmt.Printf("ID: %s\n", team.ID)
	fmt.Printf("Kubernetes Name: %s\n", team.KubernetesName)
	fmt.Printf("Name: %s\n", team.Name)
	fmt.Printf("Namespace: %s\n", team.Namespace)
}

// Create a new group
func (self *cli) createGroup(name, description string) {
	ctx := context.Background()

	// Validate inputs
	if name == "" {
		log.Errorf("Error: group name is required")
		return
	}

	// Check if group already exists
	exists, err := self.repository.Ent().Group.Query().
		Where(group.NameEQ(name)).
		Exist(ctx)
	if err != nil {
		log.Errorf("Error checking if group exists: %v", err)
		return
	}
	if exists {
		log.Errorf("Error: Group '%s' already exists", name)
		return
	}

	// Create the group
	groupBuilder := self.repository.Ent().Group.Create().
		SetName(name).
		SetDescription(description)

	// Save the group
	group, err := groupBuilder.Save(ctx)
	if err != nil {
		fmt.Printf("Error creating group: %v\n", err)
		return
	}

	fmt.Println("Group created successfully:")
	fmt.Printf("ID: %s\n", group.ID)
	fmt.Printf("Name: %s\n", group.Name)
	fmt.Printf("Description: %s\n", group.Description)
}

// Add a user to a group
func (self *cli) addUserToGroup(userEmail, groupName string) {
	ctx := context.Background()

	// Get the user
	dbUser, err := self.repository.User().GetByEmail(ctx, userEmail)
	if err != nil {
		fmt.Printf("Error: User '%s' not found: %v\n", userEmail, err)
		return
	}

	// Get the group
	group, err := self.repository.Ent().Group.Query().
		Where(group.NameEQ(groupName)).
		Only(ctx)
	if err != nil {
		fmt.Printf("Error: Group '%s' not found: %v\n", groupName, err)
		return
	}

	// Check if user is already in the group
	inGroup, err := self.repository.Ent().Group.QueryUsers(group).
		Where(user.IDEQ(dbUser.ID)).
		Exist(ctx)
	if err != nil {
		fmt.Printf("Error checking if user is in group: %v\n", err)
		return
	}
	if inGroup {
		fmt.Printf("User '%s' is already in group '%s'\n", userEmail, groupName)
		return
	}

	// Add user to group
	err = self.repository.Ent().Group.UpdateOne(group).
		AddUserIDs(dbUser.ID).
		Exec(ctx)
	if err != nil {
		fmt.Printf("Error adding user to group: %v\n", err)
		return
	}

	fmt.Printf("Successfully added user '%s' to group '%s'\n", userEmail, groupName)
}

// List permissions for a group
func (self *cli) listGroupPermissions(groupName string) {
	ctx := context.Background()

	// Get the group
	group, err := self.repository.Ent().Group.Query().
		Where(group.NameEQ(groupName)).
		Only(ctx)
	if err != nil {
		fmt.Printf("Error: Group '%s' not found: %v\n", groupName, err)
		return
	}

	// Get permissions
	perms, err := self.repository.Ent().Group.QueryPermissions(group).All(ctx)
	if err != nil {
		fmt.Printf("Error querying permissions: %v\n", err)
		return
	}

	// Print permissions
	fmt.Printf("Permissions for group '%s':\n", groupName)
	fmt.Println("-------------------------------------")
	for i, p := range perms {
		fmt.Printf("%d. %s %s:%s\n", i+1, p.Action, p.ResourceType, p.ResourceSelector.ID)
	}
	fmt.Println("-------------------------------------")
	fmt.Printf("Total permissions: %d\n", len(perms))
}

// Grant permission to a group
func (self *cli) grantPermission(groupName, action, resourceType, resourceID string) {
	ctx := context.Background()

	// Get the group
	group, err := self.repository.Ent().Group.Query().
		Where(group.NameEQ(groupName)).
		Only(ctx)
	if err != nil {
		fmt.Printf("Error: Group '%s' not found: %v\n", groupName, err)
		return
	}

	// Parse action
	var permAction schema.PermittedAction
	switch strings.ToLower(action) {
	case "view":
		permAction = schema.ActionViewer
	case "admin":
		permAction = schema.ActionAdmin
	case "edit":
		permAction = schema.ActionEditor
	default:
		fmt.Printf("Error: Invalid action '%s'. Valid actions are: admin, edit, view \n", action)
		return
	}

	// Parse resource type
	var permResourceType schema.ResourceType
	switch strings.ToLower(resourceType) {
	case "system":
		permResourceType = schema.ResourceTypeSystem
	case "team":
		permResourceType = schema.ResourceTypeTeam
	case "project":
		permResourceType = schema.ResourceTypeProject
	case "environment":
		permResourceType = schema.ResourceTypeEnvironment
	case "service":
		permResourceType = schema.ResourceTypeService
	default:
		fmt.Printf("Error: Invalid resource type '%s'. Valid types are: system, team, project, environmne, servvice\n", resourceType)
		return
	}

	selector := schema.ResourceSelector{}
	if resourceID == "*" {
		selector.Superuser = true
	} else {
		selector.ID = uuid.MustParse(resourceID)
	}

	perm, err := self.groupService.GrantPermissionToGroup(
		ctx,
		group_service.SUPER_USER_ID,
		group.ID,
		permAction,
		permResourceType,
		selector,
	)
	if err != nil {
		fmt.Printf("Error granting permission: %v\n", err)
		return
	}

	fmt.Println("Permission granted successfully:")
	fmt.Printf("ID: %s\n", perm.ID)
	fmt.Printf("Action: %s\n", perm.Action)
	fmt.Printf("Resource Type: %s\n", perm.ResourceType)
	fmt.Printf("Resource ID: %s\n", resourceID)
}

// Sync permissions with K8s
func (self *cli) syncPermissionsWithK8S() {
	if err := self.rbacManager.SyncAllGroups(context.Background()); err != nil {
		fmt.Printf("Error syncing permissions: %v\n", err)
		return
	}
}

// Sync secrets with K8s
func (self *cli) syncSecrets() {
	teams, err := self.repository.Ent().Team.Query().All(context.Background())
	if err != nil {
		fmt.Printf("Error querying teams: %v\n", err)
		return
	}

	kubeConfig, err := rest.InClusterConfig()
	if err != nil {
		log.Fatalf("Error getting in-cluster config: %v", err)
	}
	client, err := kubernetes.NewForConfig(kubeConfig)
	if err != nil {
		log.Fatalf("Error creating clientset: %v", err)
	}

	for _, t := range teams {
		// Copy registry credentials to team namespace
		registries, err := self.repository.Ent().Registry.Query().All(context.Background())
		if err != nil {
			fmt.Printf("Error querying registries: %v\n", err)
			return
		}

		for _, r := range registries {
			_, err := self.k8s.CopySecret(context.Background(), r.KubernetesSecret, self.cfg.SystemNamespace, t.Namespace, client)
			if err != nil {
				fmt.Printf("Error copying secret to team %s: %v\n", t.KubernetesName, err)
				return
			}
		}

		// Get projects, environments, services
		projects, err := self.repository.Ent().Project.Query().
			Where(project.TeamIDEQ(t.ID)).
			WithEnvironments(func(eq *ent.EnvironmentQuery) {
				eq.WithServices()
			}).
			All(context.Background())
		if err != nil {
			fmt.Printf("Error querying projects: %v\n", err)
			return
		}

		// Create team secret
		secret, _, err := self.k8s.GetOrCreateSecret(context.Background(), t.KubernetesName, t.Namespace, client)
		if err != nil {
			fmt.Printf("Error creating secret: %v\n", err)
			return
		}
		// Update team
		if _, err := self.repository.Ent().Team.UpdateOne(t).
			SetKubernetesSecret(secret.Name).
			Save(context.Background()); err != nil {
			fmt.Printf("Error updating team: %v\n", err)
			return
		}

		// Create project secrets
		for _, p := range projects {
			// Create secret
			secret, _, err := self.k8s.GetOrCreateSecret(context.Background(), p.KubernetesName, t.Namespace, client)
			if err != nil {
				fmt.Printf("Error creating secret: %v\n", err)
				return
			}
			// Update project
			if _, err := self.repository.Ent().Project.UpdateOne(p).
				SetKubernetesSecret(secret.Name).
				Save(context.Background()); err != nil {
				fmt.Printf("Error updating project: %v\n", err)
				return
			}

			// Create environment secrets
			for _, e := range p.Edges.Environments {
				// Create secret
				secret, _, err := self.k8s.GetOrCreateSecret(context.Background(), e.KubernetesName, t.Namespace, client)
				if err != nil {
					fmt.Printf("Error creating secret: %v\n", err)
					return
				}
				// Update environment
				if _, err := self.repository.Ent().Environment.UpdateOne(e).
					SetKubernetesSecret(secret.Name).
					Save(context.Background()); err != nil {
					fmt.Printf("Error updating environment: %v\n", err)
					return
				}

				// Create service secrets
				for _, s := range e.Edges.Services {
					// Create secret
					secret, _, err := self.k8s.GetOrCreateSecret(context.Background(), s.KubernetesName, t.Namespace, client)
					if err != nil {
						fmt.Printf("Error creating secret: %v\n", err)
						return
					}
					// Update service
					if _, err := self.repository.Ent().Service.UpdateOne(s).
						SetKubernetesSecret(secret.Name).
						Save(context.Background()); err != nil {
						fmt.Printf("Error updating service: %v\n", err)
						return
					}
				}
			}
		}
	}
}

// Create a new user
func (self *cli) createUser(email, password string) {
	// Validate inputs
	if email == "" || password == "" {
		log.Errorf("Error: email and password are required")
		return
	}

	// Check if username already exists
	_, checkErr := self.repository.User().GetByEmail(context.Background(), email)
	if checkErr != nil {
		if !ent.IsNotFound(checkErr) {
			log.Errorf("Error checking if user exists: %v", checkErr)
			return
		}
	}
	if checkErr == nil {
		log.Errorf("Error: Email '%s' already exists", email)
		return
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Printf("Error hashing password: %v\n", err)
		return
	}

	// Create the user
	u, err := self.repository.Ent().User.Create().
		SetEmail(email).
		SetPasswordHash(string(hashedPassword)).
		Save(context.Background())

	if err != nil {
		fmt.Printf("Error creating user: %v\n", err)
		return
	}

	fmt.Println("User created successfully:")
	fmt.Printf("ID: %s\n", u.ID)
	fmt.Printf("Email: %s\n", u.Email)
}

// Change password for an existing user
func (self *cli) changeUserPassword(email, password string) {
	// Validate inputs
	if email == "" || password == "" {
		log.Errorf("Error: email and password are required")
		return
	}

	// Check if username already exists
	u, err := self.repository.User().GetByEmail(context.Background(), email)
	if err != nil {
		if !ent.IsNotFound(err) {
			log.Errorf("Error checking if user exists: %v", err)
			return
		}
		if ent.IsNotFound(err) {
			log.Errorf("Error: User '%s' not found", email)
			return
		}
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Printf("Error hashing password: %v\n", err)
		return
	}

	// Create the user
	_, err = self.repository.Ent().User.UpdateOneID(u.ID).
		SetPasswordHash(string(hashedPassword)).
		Save(context.Background())

	if err != nil {
		fmt.Printf("Error updating user: %v\n", err)
		return
	}

	fmt.Println("Password updated successfully:")
	fmt.Printf("ID: %s\n", u.ID)
	fmt.Printf("Email: %s\n", u.Email)
}
