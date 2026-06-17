package template_repo

import (
	"context"
	"database/sql"
	"errors"

	"github.com/hashicorp/go-multierror"
	entTemplate "github.com/unbindapp/unbind-api/ent/template"
	"github.com/unbindapp/unbind-api/pkg/templates"
)

func (self *TemplateRepository) UpsertPredefinedTemplates(ctx context.Context) (result error) {
	templates := templates.NewTemplater(nil).AvailableTemplates()

	for _, template := range templates {
		err := self.base.DB.Template.Create().
			SetName(template.Name).
			SetDisplayRank(template.DisplayRank).
			SetIcon(template.Icon).
			SetDescription(template.Description).
			SetKeywords(template.Keywords).
			SetResourceRecommendations(template.ResourceRecommendations).
			SetVersion(template.Version).
			SetDefinition(*template).
			SetImmutable(true).
			OnConflictColumns(entTemplate.FieldName, entTemplate.FieldVersion).
			DoNothing().
			Exec(ctx)
			// Ignore no rows in result set error
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			result = multierror.Append(result, err)
		}
	}

	return result
}
