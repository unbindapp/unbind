package variable_repo

import (
	"context"

	"entgo.io/ent/dialect/sql"
	"entgo.io/ent/dialect/sql/sqljson"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/project"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/team"
	"github.com/unbindapp/unbind-api/ent/variablereference"
)

func (self *VariableRepository) GetReferenceByID(ctx context.Context, id uuid.UUID) (*ent.VariableReference, error) {
	return self.base.DB.VariableReference.Query().
		Where(
			variablereference.ID(id),
		).
		Only(ctx)
}

func (self *VariableRepository) GetReferencesForService(
	ctx context.Context,
	serviceID uuid.UUID,
) ([]*ent.VariableReference, error) {
	// Get all references for a service
	references, err := self.base.DB.VariableReference.Query().
		Where(variablereference.TargetServiceIDEQ(serviceID)).
		Order(
			ent.Desc(variablereference.FieldCreatedAt),
		).
		All(ctx)
	if err != nil {
		return nil, err
	}

	if len(references) == 0 {
		return references, nil
	}

	// Get the source names
	var teamIDs, projectIDs, environmentIDs, serviceIDs []uuid.UUID
	for _, reference := range references {
		for _, source := range reference.Sources {
			switch source.SourceType {
			case schema.VariableReferenceSourceTypeTeam:
				teamIDs = append(teamIDs, source.SourceID)
			case schema.VariableReferenceSourceTypeProject:
				projectIDs = append(projectIDs, source.SourceID)
			case schema.VariableReferenceSourceTypeEnvironment:
				environmentIDs = append(environmentIDs, source.SourceID)
			case schema.VariableReferenceSourceTypeService:
				serviceIDs = append(serviceIDs, source.SourceID)
			}
		}
	}

	// Get the name map
	kubernetsNameMap := make(map[uuid.UUID]string)
	nameMap := make(map[uuid.UUID]string)
	iconMap := make(map[uuid.UUID]string)

	if len(teamIDs) > 0 {
		teams, err := self.base.DB.Team.Query().
			Where(
				team.IDIn(teamIDs...),
			).
			Select(team.FieldName).
			All(ctx)
		if err != nil {
			return nil, err
		}
		for _, team := range teams {
			nameMap[team.ID] = team.Name
		}
	}
	if len(projectIDs) > 0 {
		projects, err := self.base.DB.Project.Query().
			Where(
				project.IDIn(projectIDs...),
			).
			Select(project.FieldName).
			All(ctx)
		if err != nil {
			return nil, err
		}
		for _, project := range projects {
			nameMap[project.ID] = project.Name
		}
	}
	if len(environmentIDs) > 0 {
		environments, err := self.base.DB.Environment.Query().
			Where(
				environment.IDIn(environmentIDs...),
			).
			Select(environment.FieldName).
			All(ctx)
		if err != nil {
			return nil, err
		}
		for _, environment := range environments {
			nameMap[environment.ID] = environment.Name
		}
	}
	if len(serviceIDs) > 0 {
		services, err := self.base.DB.Service.Query().
			Where(
				service.IDIn(serviceIDs...),
			).
			Select(service.FieldKubernetesName, service.FieldName).
			WithServiceConfig().
			All(ctx)
		if err != nil {
			return nil, err
		}
		for _, service := range services {
			kubernetsNameMap[service.ID] = service.KubernetesName
			nameMap[service.ID] = service.Name
			iconMap[service.ID] = service.Edges.ServiceConfig.Icon
		}
	}

	// Set the names
	for _, reference := range references {
		for i, source := range reference.Sources {
			if name, ok := nameMap[source.SourceID]; ok {
				reference.Sources[i].SourceName = name
			}
			switch source.SourceType {
			case schema.VariableReferenceSourceTypeService:
				if icon, ok := iconMap[source.SourceID]; ok {
					reference.Sources[i].SourceIcon = icon
				}
				if kubernetesName, ok := kubernetsNameMap[source.SourceID]; ok {
					reference.Sources[i].SourceKubernetesName = kubernetesName
				}
			case schema.VariableReferenceSourceTypeEnvironment:
				reference.Sources[i].SourceIcon = "environment"
			case schema.VariableReferenceSourceTypeProject:
				reference.Sources[i].SourceIcon = "project"
			case schema.VariableReferenceSourceTypeTeam:
				reference.Sources[i].SourceIcon = "team"
			}
		}
	}

	return references, nil
}

func (self *VariableRepository) GetServicesReferencingID(ctx context.Context, id uuid.UUID, keys []string) ([]*ent.Service, error) {
	predicates := make([]*sql.Predicate, 0, len(keys))
	for _, k := range keys {
		predicates = append(predicates,
			sqljson.ValueContains(
				variablereference.FieldSources,
				[]map[string]any{{
					"source_id": id.String(),
					"key":       k,
				}},
			),
		)
	}

	references, err := self.base.DB.VariableReference.
		Query().
		Select(variablereference.FieldTargetServiceID).
		Where(func(sel *sql.Selector) {
			sel.Where(sql.Or(predicates...))
		}).
		All(ctx)
	if err != nil {
		return nil, err
	}

	if len(references) == 0 {
		return nil, nil
	}

	serviceIDs := make([]uuid.UUID, len(references))
	for i, reference := range references {
		serviceIDs[i] = reference.TargetServiceID
	}

	return self.base.DB.Service.Query().
		Where(service.IDIn(serviceIDs...)).
		WithServiceConfig().
		WithCurrentDeployment().
		WithGithubInstallation().
		All(ctx)
}
