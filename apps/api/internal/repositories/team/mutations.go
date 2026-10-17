package team_repo

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/permission"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/team"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// MemberRoles are the roles a team hands out, each backed by one role group.
var MemberRoles = []schema.PermittedAction{schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer}

func (self *TeamRepository) Create(ctx context.Context, tx repository.TxInterface, kubernetesName, name, namespace, kubernetesSecret string, description *string) (*ent.Team, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.Team.Create().
		SetKubernetesName(kubernetesName).
		SetName(name).
		SetNamespace(namespace).
		SetKubernetesSecret(kubernetesSecret).
		SetNillableDescription(description).
		Save(ctx)
}

func (self *TeamRepository) Update(ctx context.Context, teamID uuid.UUID, name string, description *string) (*ent.Team, error) {
	m := self.base.DB.Team.UpdateOneID(teamID)
	if name != "" {
		m.SetName(name)
	}
	if description != nil {
		if *description == "" {
			m.ClearDescription()
		} else {
			m.SetDescription(*description)
		}
	}
	if err := m.Exec(ctx); err != nil {
		return nil, err
	}
	return self.base.DB.Team.Query().
		Where(team.ID(teamID)).
		WithIcon(withIconTime).
		Only(ctx)
}

// Delete removes the team, its role groups (by cascade) and every grant that
// named the team, so no group keeps a dangling permission.
func (self *TeamRepository) Delete(ctx context.Context, tx repository.TxInterface, teamID uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	grants, err := db.Permission.Query().
		Where(permission.ResourceTypeEQ(schema.ResourceTypeTeam)).
		All(ctx)
	if err != nil {
		return err
	}
	var stale []uuid.UUID
	for _, grant := range grants {
		if grant.ResourceSelector.ID == teamID {
			stale = append(stale, grant.ID)
		}
	}
	if len(stale) > 0 {
		if _, err := db.Permission.Delete().Where(permission.IDIn(stale...)).Exec(ctx); err != nil {
			return err
		}
	}

	return db.Team.DeleteOneID(teamID).Exec(ctx)
}

// EnsureRoleGroups creates the team's admin, editor and viewer groups where they
// are missing, each holding exactly that role on the team.
func (self *TeamRepository) EnsureRoleGroups(ctx context.Context, tx repository.TxInterface, team *ent.Team) ([]*ent.Group, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	existing, err := db.Team.QueryRoleGroups(team).All(ctx)
	if err != nil {
		return nil, err
	}
	byRole := map[schema.PermittedAction]*ent.Group{}
	for _, group := range existing {
		if group.Role != nil {
			byRole[*group.Role] = group
		}
	}

	groups := make([]*ent.Group, 0, len(MemberRoles))
	for _, role := range MemberRoles {
		if group, ok := byRole[role]; ok {
			groups = append(groups, group)
			continue
		}

		perm, err := db.Permission.Create().
			SetAction(role).
			SetResourceType(schema.ResourceTypeTeam).
			SetResourceSelector(schema.ResourceSelector{ID: team.ID}).
			Save(ctx)
		if err != nil {
			return nil, err
		}

		group, err := db.Group.Create().
			SetName(RoleGroupName(team, role)).
			SetDescription(fmt.Sprintf("%s role on team %s", role, team.Name)).
			SetTeamID(team.ID).
			SetRole(role).
			AddPermissions(perm).
			Save(ctx)
		if err != nil {
			return nil, err
		}
		groups = append(groups, group)
	}

	return groups, nil
}

// RoleGroupName is unique because the team's kubernetes name is, and it is what
// the Kubernetes RoleBinding subject and the token's groups claim carry.
func RoleGroupName(team *ent.Team, role schema.PermittedAction) string {
	return fmt.Sprintf("team-%s-%s", team.KubernetesName, role)
}
