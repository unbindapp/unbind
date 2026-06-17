package databases

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"gopkg.in/yaml.v2"
)

// FetchDatabaseDefinition downloads the metadata/definition for the requested
// database, resolves $ref imports, converts every YAML map to
// map[string]any, and returns a Definition ready for Huma to marshal.
func (p *DatabaseProvider) FetchDatabaseDefinition(
	ctx context.Context,
	tagVersion, dbType string,
) (*Definition, error) {
	//----------------------------------------------------------------------
	// 1. Download metadata + definition files
	//----------------------------------------------------------------------
	baseURL := fmt.Sprintf(BaseDatabaseURL, tagVersion)

	metadataURL := fmt.Sprintf("%s/definitions/%s/%s/metadata.yaml",
		baseURL, DB_CATEGORY, dbType)
	defURL := fmt.Sprintf("%s/definitions/%s/%s/definition.yaml",
		baseURL, DB_CATEGORY, dbType)

	metadataBytes, err := p.fetchURL(ctx, metadataURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metadata: %w", err)
	}

	defBytes, err := p.fetchURL(ctx, defURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch database definition: %w", err)
	}

	//----------------------------------------------------------------------
	// 2. Parse metadata YAML
	//----------------------------------------------------------------------
	var metadata DefinitionMetadata
	if err := yaml.Unmarshal(metadataBytes, &metadata); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}
	metadata.Schema.Imports = make(map[string]any)

	//----------------------------------------------------------------------
	// 3. Pull in declared imports
	//----------------------------------------------------------------------
	for _, imp := range metadata.Imports {
		dbBasePath := fmt.Sprintf("definitions/%s/%s", DB_CATEGORY, dbType)
		importPath := resolveRelativePath(dbBasePath, imp.Path)
		importURL := fmt.Sprintf("%s/%s", baseURL, importPath)

		importBytes, err := p.fetchURL(ctx, importURL)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch import %s: %w", imp.Path, err)
		}

		var importYAML any
		if err := yaml.Unmarshal(importBytes, &importYAML); err != nil {
			return nil, fmt.Errorf("failed to parse import %s: %w", imp.Path, err)
		}
		norm, err := convertToJSONCompatible(importYAML)
		if err != nil {
			return nil, err
		}
		metadata.Schema.Imports[imp.As] = norm
	}

	//----------------------------------------------------------------------
	// 4. Resolve $ref in the schema
	//----------------------------------------------------------------------
	resolvedSchema, err := p.resolveReferences(metadata.Schema)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve $ref: %w", err)
	}

	//----------------------------------------------------------------------
	// 5. Make the *entire* schema JSON-safe in one shot
	//----------------------------------------------------------------------
	safeSchema, err := makeSchemaJSONSafe(resolvedSchema)
	if err != nil {
		return nil, fmt.Errorf("schema sanitisation: %w", err)
	}

	//----------------------------------------------------------------------
	// 6. Build and validate the Definition
	//----------------------------------------------------------------------
	db := &Definition{
		Name:        metadata.Name,
		Description: metadata.Description,
		Port:        metadata.Port,
		Type:        metadata.Type,
		Version:     metadata.Version,
		Schema:      safeSchema,
		Content:     string(defBytes),
		Chart:       metadata.Chart,
	}

	if db.Type == "helm" && (db.Chart == nil || db.Chart.Name == "" || db.Chart.Version == "" || db.Chart.Repository == "" || db.Chart.RepositoryName == "") {
		return nil, fmt.Errorf("chart information is required for Helm database type")
	}

	//----------------------------------------------------------------------
	// 7. Extra safety: ensure JSON marshal still works
	//----------------------------------------------------------------------
	if _, err := json.Marshal(db); err != nil {
		return nil, fmt.Errorf("definition still not JSON-safe: %w", err)
	}

	return db, nil
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// convertToJSONCompatible recursively converts every map[any]any
// or []any element into JSON-safe forms.
func convertToJSONCompatible(in any) (any, error) {
	switch v := in.(type) {
	case map[any]any:
		out := make(map[string]any, len(v))
		for k, val := range v {
			ks, ok := k.(string)
			if !ok {
				return nil, fmt.Errorf("map key %v is not a string", k)
			}
			conv, err := convertToJSONCompatible(val)
			if err != nil {
				return nil, err
			}
			out[ks] = conv
		}
		return out, nil

	case []any:
		out := make([]any, len(v))
		for i, val := range v {
			conv, err := convertToJSONCompatible(val)
			if err != nil {
				return nil, err
			}
			out[i] = conv
		}
		return out, nil

	default:
		return v, nil
	}
}

// makeSchemaJSONSafe converts the whole DefinitionParameterSchema into a YAML
// blob, loads it back as an arbitrary any, runs convertToJSONCompatible
// on that, then re-unmarshals it into the strongly typed struct.  That way we
// don't need to know which fields your ParameterProperty actually has.
func makeSchemaJSONSafe(
	s DefinitionParameterSchema,
) (DefinitionParameterSchema, error) {
	// 1. Marshal the typed struct to YAML
	yamlBytes, err := yaml.Marshal(s)
	if err != nil {
		return s, err
	}

	// 2. Load the YAML into an arbitrary any
	var asAny any
	if err := yaml.Unmarshal(yamlBytes, &asAny); err != nil {
		return s, err
	}

	// 3. Convert every map to map[string]any
	conv, err := convertToJSONCompatible(asAny)
	if err != nil {
		return s, err
	}

	// 4. Marshal back to JSON, then unmarshal into the typed struct
	jsonBytes, _ := json.Marshal(conv)
	var out DefinitionParameterSchema
	if err := json.Unmarshal(jsonBytes, &out); err != nil {
		return s, err
	}
	return out, nil
}

// resolveRelativePath resolves ../ or ./ sequences against a base directory.
func resolveRelativePath(basePath, rel string) string {
	if !strings.HasPrefix(rel, "../") && !strings.HasPrefix(rel, "./") {
		return rel // already absolute
	}
	base := strings.Split(basePath, "/")
	parts := strings.Split(rel, "/")

	if strings.HasPrefix(rel, "./") {
		return strings.Join(append(base, parts[1:]...), "/")
	}

	stack := append([]string{}, base...)
	for _, p := range parts {
		switch p {
		case "..":
			if len(stack) > 0 {
				stack = stack[:len(stack)-1]
			}
		default:
			stack = append(stack, p)
		}
	}
	return strings.Join(stack, "/")
}

// resolveReferences resolves $ref references in the schema
func (self *DatabaseProvider) resolveReferences(schema DefinitionParameterSchema) (DefinitionParameterSchema, error) {
	// Create a deep copy of the schema
	resolvedSchema := schema

	// Resolve references in properties
	for name, prop := range resolvedSchema.Properties {
		if prop.Ref != "" {
			// Parse the reference path
			// Format: "#/imports/s3Schema"
			parts := strings.Split(prop.Ref, "/")
			if len(parts) < 3 || parts[0] != "#" || parts[1] != "imports" {
				return resolvedSchema, fmt.Errorf("invalid reference: %s", prop.Ref)
			}

			importName := parts[2]
			importSchema, ok := schema.Imports[importName]
			if !ok {
				return resolvedSchema, fmt.Errorf("import not found: %s", importName)
			}

			// Convert to YAML and back to get the right structure
			importBytes, err := yaml.Marshal(importSchema)
			if err != nil {
				return resolvedSchema, err
			}

			var importedProp ParameterProperty
			if err := yaml.Unmarshal(importBytes, &importedProp); err != nil {
				return resolvedSchema, err
			}

			// Replace the reference with the actual schema
			resolvedSchema.Properties[name] = importedProp
		}
	}

	return resolvedSchema, nil
}
