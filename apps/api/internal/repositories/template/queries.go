package template_repo

import (
	"context"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/template"
)

func (self *TemplateRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.Template, error) {
	template, err := self.base.DB.Template.Query().
		Where(template.ID(id)).Only(ctx)
	if err != nil {
		return nil, err
	}

	return template, nil
}

func (self *TemplateRepository) GetAll(ctx context.Context) ([]*ent.Template, error) {
	templates, err := self.base.DB.Template.Query().
		All(ctx)
	if err != nil {
		return nil, err
	}

	// Create a map to store the newest version of each template name
	newestVersions := make(map[string]*ent.Template)

	// Iterate through all templates
	for _, tmpl := range templates {
		// If this name hasn't been seen yet, or if this version is newer than the stored one
		existingTmpl, exists := newestVersions[tmpl.Name]
		if !exists || tmpl.Version > existingTmpl.Version {
			newestVersions[tmpl.Name] = tmpl
		}
	}

	// Convert the map back to a slice
	result := make([]*ent.Template, 0, len(newestVersions))
	for _, tmpl := range newestVersions {
		result = append(result, tmpl)
	}

	// Sort by DisplayRank, then alphabetically if ranks tie.
	sort.Slice(result, func(i, j int) bool {
		if result[i].DisplayRank != result[j].DisplayRank {
			return result[i].DisplayRank < result[j].DisplayRank // lower rank first
		}
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})

	return result, nil
}
