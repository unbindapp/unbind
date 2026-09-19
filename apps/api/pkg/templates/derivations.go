package templates

import (
	"regexp"
	"slices"
	"strings"

	"github.com/unbindapp/unbind-api/ent/schema"
)

var placeholderPattern = regexp.MustCompile(`\$\{([A-Za-z0-9_.]+)\}`)

// VariableDerivations finds the variables of an unrendered template service whose value
// depends on another variable of the same service: keys a generator derives from a
// secret, and string-replace values that embed a variable. Recording them lets Unbind
// keep them in sync when the variable they depend on is edited after the deploy.
func VariableDerivations(service schema.TemplateService) map[string]*schema.VariableDerivation {
	derivations := make(map[string]*schema.VariableDerivation)
	names := make([]string, 0, len(service.Variables))

	for _, variable := range service.Variables {
		names = append(names, variable.Name)
		if variable.Generator == nil {
			continue
		}
		switch variable.Generator.Type {
		case schema.GeneratorTypeConvexAdminKey:
			params := variable.Generator.ConvexParams
			if params == nil {
				continue
			}
			names = append(names, params.SecretOutputKey, params.AdminKeyOutputKey)
			derivations[params.AdminKeyOutputKey] = &schema.VariableDerivation{
				Type:               schema.VariableDerivationConvexAdminKey,
				Sources:            []string{params.SecretOutputKey},
				ConvexInstanceName: params.InstanceName,
			}
		case schema.GeneratorTypeJWT:
			params := variable.Generator.JWTParams
			if params == nil {
				continue
			}
			names = append(names, params.SecretOutputKey, params.AnonOutputKey, params.ServiceOutputKey)
			for key, role := range map[string]string{params.AnonOutputKey: "anon", params.ServiceOutputKey: "service_role"} {
				derivations[key] = &schema.VariableDerivation{
					Type:      schema.VariableDerivationJWT,
					Sources:   []string{params.SecretOutputKey},
					JWTIssuer: params.Issuer,
					JWTRole:   role,
				}
			}
		}
	}

	prefix := strings.ToUpper(service.ID) + "_"
	for _, variable := range service.Variables {
		if variable.Generator == nil || variable.Generator.Type != schema.GeneratorTypeStringReplace {
			continue
		}
		var sources []string
		for _, match := range placeholderPattern.FindAllStringSubmatch(variable.Value, -1) {
			source, ours := strings.CutPrefix(match[1], prefix)
			if !ours || source == variable.Name || !slices.Contains(names, source) || slices.Contains(sources, source) {
				continue
			}
			sources = append(sources, source)
		}
		if len(sources) == 0 {
			continue
		}
		slices.Sort(sources)
		derivations[variable.Name] = &schema.VariableDerivation{
			Type:    schema.VariableDerivationEmbedded,
			Sources: sources,
		}
	}

	return derivations
}
