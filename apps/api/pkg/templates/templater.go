package templates

import (
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type Templater struct {
	cfg *config.Config
}

func NewTemplater(cfg *config.Config) *Templater {
	return &Templater{
		cfg: cfg,
	}
}
func (self *Templater) AvailableTemplates() []*schema.TemplateDefinition {
	return []*schema.TemplateDefinition{
		wordPressTemplate(),
		ghostTemplate(),
		minioTemplate(),
		meiliSearchTemplate(),
		plausibleTemplate(),
		umamiTemplate(),
		wireGuardTemplate(),
		supabaseTemplate(),
		n8nTemplate(),
		pocketBaseTemplate(),
		flowiseTemplate(),
		listmonkTemplate(),
		appsmithTemplate(),
		nocodbTemplate(),
		teableTemplate(),
		formbricksTemplate(),
	}
}
