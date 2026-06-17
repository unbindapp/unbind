package main

import (
	"context"
	"fmt"

	"github.com/hashicorp/go-multierror"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/buildkitd"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	system_repo "github.com/unbindapp/unbind-api/internal/repositories/system"
	"k8s.io/apimachinery/pkg/api/errors"
)

type Bootstrapper struct {
	cfg                     *config.Config
	repos                   repositories.RepositoriesInterface
	kubeClient              *k8s.KubeClient
	buildkitSettingsManager *buildkitd.BuildkitSettingsManager
}

func (self *Bootstrapper) Sync(ctx context.Context) error {
	var multierr *multierror.Error

	// Sync system settings
	multierr = multierror.Append(multierr, self.syncSystemSettings(ctx))
	multierr = multierror.Append(multierr, self.syncBuildkitdSettings(ctx))
	// Bootstrap registry
	multierr = multierror.Append(multierr, self.bootstrapRegistry(ctx))
	// Bootstrap team
	multierr = multierror.Append(multierr, self.bootstrapTeam(ctx))
	// Bootstrap groups and permissions
	multierr = multierror.Append(multierr, self.bootstrapGroupsAndPermissions(ctx))
	// Sync RBAC
	multierr = multierror.Append(multierr, self.syncK8sRBAC(ctx))

	return multierr.ErrorOrNil()
}

// * System settings
func (self *Bootstrapper) syncSystemSettings(ctx context.Context) error {
	log.Infof("Syncing system settings")

	var wildcardDomain *string

	if self.cfg.BootstrapWildcardBaseURL != "" {
		wildcardDomain = utils.ToPtr(self.cfg.BootstrapWildcardBaseURL)
	}

	_, err := self.repos.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{
		WildcardDomain: wildcardDomain,
	})

	return err
}

// * Buildkit
func (self *Bootstrapper) syncBuildkitdSettings(ctx context.Context) error {
	log.Infof("Syncing buildkitd settings")

	// Get from kubernetes
	_, err := self.buildkitSettingsManager.GetBuildkitConfig(ctx)
	if err != nil {
		if errors.IsNotFound(err) {
			log.Infof("Buildkitd config not found - assuming externally managed")
			return nil
		}
		log.Errorf("Failed to get buildkitd settings from kubernetes: %v", err)
		return err
	}

	// Get buildkit settings from DB
	settings, err := self.repos.System().GetSystemSettings(ctx, nil)
	if err != nil && !ent.IsNotFound(err) {
		log.Errorf("Failed to get settings from DB: %v", err)
		return err
	}

	if ent.IsNotFound(err) {
		// Create record
		parallelism, err := self.buildkitSettingsManager.GetCurrentMaxParallelism(ctx)
		if err != nil {
			log.Errorf("Failed to get current max parallelism: %v", err)
			return err
		}
		// Get replicas
		replicas, err := self.buildkitSettingsManager.GetCurrentReplicas(ctx)
		if err != nil {
			log.Errorf("Failed to get current replicas: %v", err)
			return err
		}

		log.Infof("Creating buildkitd settings in DB: replicas=%d, parallelism=%d", replicas, parallelism)
		_, err = self.repos.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{
			BuildkitSettings: &schema.BuildkitSettings{
				Replicas:       replicas,
				MaxParallelism: parallelism,
			},
		})
		if err != nil {
			log.Errorf("Failed to create buildkit settings in DB: %v", err)
			return err
		}

		log.Info("Updated buildkitd settings", "replicas", replicas, "parallelism", parallelism)
		return nil
	}

	// Sync with kubernetes
	parallelism, err := self.buildkitSettingsManager.GetCurrentMaxParallelism(ctx)
	if err != nil {
		log.Errorf("Failed to get current max parallelism: %v", err)
		return err
	}

	// Get replicas
	replicas, err := self.buildkitSettingsManager.GetCurrentReplicas(ctx)
	if err != nil {
		log.Errorf("Failed to get current replicas: %v", err)
		return err
	}

	if settings.BuildkitSettings == nil || settings.BuildkitSettings.MaxParallelism != parallelism || settings.BuildkitSettings.Replicas != replicas {
		// Update record
		log.Infof("Updating buildkitd settings in DB: replicas=%d, parallelism=%d", replicas, parallelism)
		_, err = self.repos.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{
			BuildkitSettings: &schema.BuildkitSettings{
				Replicas:       replicas,
				MaxParallelism: parallelism,
			},
		})
		if err != nil {
			log.Errorf("Failed to update buildkit settings in DB: %v", err)
			return err
		}

		log.Info("Updated buildkitd settings", "replicas", replicas, "parallelism", parallelism)
	}

	return nil
}

// * Bootstrap the registry, if needed
func (self *Bootstrapper) bootstrapRegistry(ctx context.Context) error {
	log.Infof("Bootstrapping registry if needed")

	regCount, err := self.repos.Ent().Registry.Query().Count(ctx)
	if err != nil {
		if !ent.IsNotFound(err) {
			return fmt.Errorf("failed to query registry count: %w", err)
		}
	}
	if regCount == 0 {
		// Create initial registry
		registryHost := self.cfg.BootstrapContainerRegistryHost
		if registryHost == "" {
			// Assume docker hub
			registryHost = "docker.io"
		}

		if self.cfg.BootstrapContainerRegistryUser == "" || self.cfg.BootstrapContainerRegistryPassword == "" {
			return fmt.Errorf("BOOTSTRAP_CONTAINER_REGISTRY_USER and BOOTSTRAP_CONTAINER_REGISTRY_PASSWORD must be set")
		}

		if err := self.repos.WithTx(ctx, func(tx repository.TxInterface) error {
			// Create credentials first if needed
			secretName, err := utils.GenerateSlug(registryHost)
			if err != nil {
				return fmt.Errorf("failed to generate slug for registry secret: %w", err)
			}

			// Create registry
			_, err = self.repos.System().CreateRegistry(ctx, tx, registryHost, secretName, true)
			if err != nil {
				return fmt.Errorf("failed to create registry: %w", err)
			}

			// Get teams so we can copy secret
			teams, err := tx.Client().Team.Query().All(ctx)
			if err != nil {
				return fmt.Errorf("failed to query teams: %w", err)
			}

			// Create credentials second, so if it fails the above rolls back
			_, err = self.kubeClient.CreateMultiRegistryCredentials(
				ctx,
				secretName,
				self.cfg.SystemNamespace,
				[]k8s.RegistryCredential{
					{
						RegistryURL: registryHost,
						Username:    self.cfg.BootstrapContainerRegistryUser,
						Password:    self.cfg.BootstrapContainerRegistryPassword,
					},
				},
				self.kubeClient.GetInternalClient(),
			)
			if err != nil {
				return fmt.Errorf("failed to create registry credentials: %w", err)
			}

			for _, team := range teams {
				_, err = self.kubeClient.CopySecret(ctx, secretName, self.cfg.SystemNamespace, team.Namespace, self.kubeClient.GetInternalClient())
				if err != nil {
					return fmt.Errorf("failed to copy registry credentials to team namespace: %w", err)
				}
			}

			return nil
		}); err != nil {
			return fmt.Errorf("failed to bootstrap registry: %w", err)
		}
	}
	return nil
}

// * Team
func (self *Bootstrapper) bootstrapTeam(ctx context.Context) error {
	log.Infof("Bootstrapping team if needed")

	// See if team exists
	teamCount, err := self.repos.Ent().Team.Query().Count(ctx)
	if err != nil {
		return fmt.Errorf("failed to query team count: %w", err)
	}
	if teamCount > 0 {
		// Bootstrap registry secrets if needed
		return self.syncRegistrySecretsToTeams(ctx)
	}

	// Create a team
	name := "Default"
	kubernetesName, err := utils.GenerateSlug(name)
	if err != nil {
		return fmt.Errorf("failed to generate slug for team name: %w", err)
	}
	namespace := kubernetesName

	if err := self.repos.WithTx(ctx, func(tx repository.TxInterface) error {
		db := tx.Client()
		team, err := db.Team.Create().
			SetKubernetesName(kubernetesName).
			SetName(name).
			SetNamespace(namespace).
			SetKubernetesSecret(kubernetesName).Save(ctx)
		if err != nil {
			return fmt.Errorf("error creating team: %v", err)
		}

		// Create namespace
		_, err = self.kubeClient.CreateNamespace(
			ctx,
			kubernetesName,
			self.kubeClient.GetInternalClient(),
		)
		if err != nil {
			return fmt.Errorf("failed to create namespace: %w", err)
		}

		// Create secret to associate with the name
		_, _, err = self.kubeClient.GetOrCreateSecret(ctx, kubernetesName, namespace, self.kubeClient.GetInternalClient())
		if err != nil {
			return fmt.Errorf("error creating secret: %v", err)
		}

		// * Create first Project
		name = "First Project"
		kubernetesName, err = utils.GenerateSlug(name)
		if err != nil {
			return fmt.Errorf("failed to generate slug for project name: %w", err)
		}
		project, err := db.Project.Create().
			SetKubernetesName(kubernetesName).
			SetName(name).
			SetTeamID(team.ID).
			SetKubernetesSecret(kubernetesName).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("error creating project: %v", err)
		}
		// Create secret to associate with the name
		_, _, err = self.kubeClient.GetOrCreateSecret(ctx, kubernetesName, namespace, self.kubeClient.GetInternalClient())
		if err != nil {
			return fmt.Errorf("error creating project secret: %v", err)
		}

		// * Create first environment
		name = "Production"
		kubernetesName, err = utils.GenerateSlug(name)
		if err != nil {
			return fmt.Errorf("failed to generate slug for environment name: %w", err)
		}

		_, err = db.Environment.Create().
			SetKubernetesName(kubernetesName).
			SetName(name).
			SetProjectID(project.ID).
			SetKubernetesSecret(kubernetesName).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("error creating environment: %v", err)
		}

		// Create secret to associate with the name
		_, _, err = self.kubeClient.GetOrCreateSecret(ctx, kubernetesName, namespace, self.kubeClient.GetInternalClient())
		if err != nil {
			return fmt.Errorf("error creating environment secret: %v", err)
		}

		return nil
	}); err != nil {
		fmt.Printf("Error creating team: %v\n", err)
		return err
	}

	// Sync registry secrets to the newly created team
	return self.syncRegistrySecretsToTeams(ctx)
}

// * Registry Team Sync
func (self *Bootstrapper) syncRegistrySecretsToTeams(ctx context.Context) error {
	log.Infof("Syncing registry secrets to teams")

	registries, err := self.repos.Ent().Registry.Query().All(ctx)
	if err != nil {
		return fmt.Errorf("failed to query registries: %w", err)
	}
	teams, err := self.repos.Ent().Team.Query().All(ctx)
	if err != nil {
		return fmt.Errorf("failed to query teams: %w", err)
	}
	for _, reg := range registries {
		for _, team := range teams {
			if reg.KubernetesSecret != "" {
				// Check existence
				secretName := reg.KubernetesSecret
				_, err := self.kubeClient.GetSecret(ctx, secretName, team.Namespace, self.kubeClient.GetInternalClient())
				if err != nil {
					if !errors.IsNotFound(err) {
						return fmt.Errorf("failed to get secret %s in team namespace %s: %w", secretName, team.Namespace, err)
					}
				}
				if errors.IsNotFound(err) {
					// Copy
					_, err = self.kubeClient.CopySecret(ctx, secretName, self.cfg.SystemNamespace, team.Namespace, self.kubeClient.GetInternalClient())
					if err != nil {
						log.Warnf("Failed to copy registry secret %s to team namespace %s: %v", secretName, team.Namespace, err)
					}
				}
			}
		}
	}

	return nil
}

// * Groups
func (self *Bootstrapper) bootstrapGroupsAndPermissions(ctx context.Context) error {
	log.Infof("Bootstrapping groups and permissions if needed")

	if err := self.repos.WithTx(ctx, func(tx repository.TxInterface) error {
		db := tx.Client()

		// See if group exists
		groupCount, err := db.Group.Query().Count(ctx)
		if err != nil {
			return fmt.Errorf("failed to query group count: %w", err)
		}
		if groupCount > 0 {
			return nil
		}

		// Create group
		group, err := db.Group.Create().
			SetName("superuser").
			SetDescription("Default superuser group").
			Save(ctx)
		if err != nil {
			return fmt.Errorf("error creating group: %v", err)
		}

		// Create permission (system)
		perm, err := db.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeSystem).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
			}).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("error creating permission: %w", err)
		}

		_, err = db.Group.UpdateOneID(group.ID).
			AddPermissionIDs(perm.ID).
			Save(ctx)

		if err != nil {
			return fmt.Errorf("error adding permission to group: %w", err)
		}

		// Create permission (team)
		perm, err = db.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeTeam).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
			}).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("error creating permission: %w", err)
		}

		_, err = db.Group.UpdateOneID(group.ID).
			AddPermissionIDs(perm.ID).
			Save(ctx)

		if err != nil {
			return fmt.Errorf("error adding permission to group: %w", err)
		}

		return nil
	}); err != nil {
		fmt.Printf("Error creating group: %v\n", err)
		return err
	}

	return nil
}

// * Sync with K8S
func (self *Bootstrapper) syncK8sRBAC(ctx context.Context) error {
	log.Infof("Syncing RBAC with Kubernetes")

	rbacManager := k8s.NewRBACManager(self.repos, self.kubeClient)

	// Get all groups
	groups, err := self.repos.Ent().Group.Query().WithPermissions().All(ctx)
	if err != nil {
		return fmt.Errorf("failed to query groups: %w", err)
	}

	for _, group := range groups {
		hasK8sAccess := false
		for _, p := range group.Edges.Permissions {
			// ! Only managing teams this way
			if p.ResourceType == schema.ResourceTypeTeam {
				hasK8sAccess = true
				break
			}
		}

		if hasK8sAccess {
			err := rbacManager.SyncGroupToK8s(ctx, group)
			if err != nil {
				return fmt.Errorf("failed to sync group %s to k8s: %w", group.Name, err)
			}
		}
	}

	return nil
}
