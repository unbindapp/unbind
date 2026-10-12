package team_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/names"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type CreateTeamInput struct {
	Name        string  `json:"name" required:"true" minLength:"1" maxLength:"32" doc:"Has to be unique"`
	Description *string `json:"description" required:"false"`
}

// CreateTeam makes a team with its namespace and role groups. It takes a system
// admin because it creates cluster resources; the creator becomes a team admin.
func (self *TeamService) CreateTeam(ctx context.Context, requesterUserID uuid.UUID, input *CreateTeamInput) (*models.TeamResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeSystem,
		},
	}
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	name, err := names.Clean(input.Name)
	if err != nil {
		return nil, err
	}

	client := self.k8s.GetInternalClient()

	var team *ent.Team
	var adminGroup *ent.Group
	namespace := ""
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		takenNames, err := self.repo.Team().GetNames(ctx, tx)
		if err != nil {
			return err
		}
		if err := names.EnsureFree(name, takenNames, "team", ""); err != nil {
			return err
		}

		kubernetesName, err := utils.GenerateSlug(name)
		if err != nil {
			return err
		}

		if _, err := self.k8s.CreateNamespace(ctx, kubernetesName, client); err != nil {
			return err
		}
		namespace = kubernetesName

		secret, _, err := self.k8s.GetOrCreateSecret(ctx, kubernetesName, namespace, client)
		if err != nil {
			return err
		}

		team, err = self.repo.Team().Create(ctx, tx, kubernetesName, name, namespace, secret.Name, input.Description)
		if err != nil {
			return err
		}

		groups, err := self.repo.Team().EnsureRoleGroups(ctx, tx, team)
		if err != nil {
			return err
		}
		adminGroup = roleGroup(groups, schema.ActionAdmin)
		if adminGroup == nil {
			return fmt.Errorf("team %s has no admin role group", team.ID)
		}
		return nil
	}); err != nil {
		if namespace != "" {
			if cleanupErr := self.k8s.DeleteNamespace(ctx, namespace, client); cleanupErr != nil {
				log.Warnf("Failed to remove namespace %s after team creation failed: %v", namespace, cleanupErr)
			}
		}
		return nil, err
	}

	if err := self.repo.Group().AddUser(ctx, adminGroup.ID, requesterUserID); err != nil {
		return nil, fmt.Errorf("error adding creator to team admins: %w", err)
	}

	// Both repair themselves on the next API start, so a failure here is logged, not returned
	if err := self.copyRegistrySecrets(ctx, namespace); err != nil {
		log.Warnf("Failed to copy registry credentials into namespace %s: %v", namespace, err)
	}
	if err := self.rbacManager.SyncAllGroups(ctx); err != nil {
		log.Warnf("Failed to sync Kubernetes RBAC after creating team %s: %v", team.ID, err)
	}

	permSet, err := self.repo.Permissions().GetUserPermissionSet(ctx, requesterUserID)
	if err != nil {
		return nil, err
	}

	resp := models.TransformTeamEntity(team)
	resp.Permissions = permSet.TeamActions(team.ID)
	return resp, nil
}

func (self *TeamService) copyRegistrySecrets(ctx context.Context, namespace string) error {
	registries, err := self.repo.System().GetAllRegistries(ctx)
	if err != nil {
		return err
	}
	client := self.k8s.GetInternalClient()
	for _, reg := range registries {
		if reg.KubernetesSecret == "" {
			continue
		}
		if _, err := self.k8s.CopySecret(ctx, reg.KubernetesSecret, self.cfg.SystemNamespace, namespace, client); err != nil {
			return fmt.Errorf("copy %s: %w", reg.KubernetesSecret, err)
		}
	}
	return nil
}

func roleGroup(groups []*ent.Group, role schema.PermittedAction) *ent.Group {
	for _, group := range groups {
		if group.Role != nil && *group.Role == role {
			return group
		}
	}
	return nil
}
