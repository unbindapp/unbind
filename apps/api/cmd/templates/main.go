// Prints the facts the docs show for each template as JSON to stdout, built
// from the template definitions. Usage: go run ./cmd/templates > templates.json
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/pkg/templates"
)

type templateFacts struct {
	Name                    string                                 `json:"name"`
	Description             string                                 `json:"description"`
	Icon                    string                                 `json:"icon"`
	Keywords                []string                               `json:"keywords"`
	ResourceRecommendations schema.TemplateResourceRecommendations `json:"resource_recommendations"`
	Inputs                  []inputFacts                           `json:"inputs"`
	Services                []serviceFacts                         `json:"services"`
}

type inputFacts struct {
	Name        string                   `json:"name"`
	Type        schema.TemplateInputType `json:"type"`
	Description string                   `json:"description"`
	Default     *string                  `json:"default,omitempty"`
	Required    bool                     `json:"required"`
}

type serviceFacts struct {
	Name         string  `json:"name"`
	Icon         string  `json:"icon"`
	Image        *string `json:"image,omitempty"`
	DatabaseType *string `json:"database_type,omitempty"`
}

func main() {
	definitions := templates.NewTemplater(&config.Config{}).AvailableTemplates()

	facts := make([]templateFacts, 0, len(definitions))
	for _, definition := range definitions {
		facts = append(facts, toTemplateFacts(definition))
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(facts); err != nil {
		fmt.Fprintln(os.Stderr, "failed to render template facts:", err)
		os.Exit(1)
	}
}

func toTemplateFacts(definition *schema.TemplateDefinition) templateFacts {
	inputs := []inputFacts{}
	for _, input := range definition.Inputs {
		if input.Hidden {
			continue
		}
		inputs = append(inputs, inputFacts{
			Name:        input.Name,
			Type:        input.Type,
			Description: input.Description,
			Default:     input.Default,
			Required:    input.Required,
		})
	}

	services := make([]serviceFacts, 0, len(definition.Services))
	for _, service := range definition.Services {
		services = append(services, serviceFacts{
			Name:         service.Name,
			Icon:         models.ResolveTemplateServiceIcon(service),
			Image:        service.Image,
			DatabaseType: service.DatabaseType,
		})
	}

	return templateFacts{
		Name:                    definition.Name,
		Description:             definition.Description,
		Icon:                    definition.Icon,
		Keywords:                definition.Keywords,
		ResourceRecommendations: definition.ResourceRecommendations,
		Inputs:                  inputs,
		Services:                services,
	}
}
