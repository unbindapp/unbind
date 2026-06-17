package databases

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"
	"time"

	"github.com/Masterminds/sprig/v3"
	mocov1beta2 "github.com/cybozu-go/moco/api/v1beta2"
	helmv2 "github.com/fluxcd/helm-controller/api/v2"
	sourcev1 "github.com/fluxcd/source-controller/api/v1"
	"github.com/google/uuid"
	postgresv1 "github.com/zalando/postgres-operator/pkg/apis/acid.zalan.do/v1"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	yamlDecoder "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/yaml"
)

// DatabaseRenderer renders a DB definition into Kubernetes resources
type DatabaseRenderer struct {
	// Use a custom scheme that can be extended with CRDs
	scheme *runtime.Scheme
}

func NewDatabaseRenderer() *DatabaseRenderer {
	// Create a new scheme that includes the core Kubernetes types
	s := runtime.NewScheme()
	_ = scheme.AddToScheme(s)

	// Add CRD types to the scheme
	_ = apiextensionsv1.AddToScheme(s)

	r := &DatabaseRenderer{
		scheme: s,
	}

	// Register known CRDs
	zalandoGVK := schema.GroupVersionKind{
		Group:   "acid.zalan.do",
		Version: "v1",
		Kind:    "postgresql",
	}
	r.RegisterCRD(zalandoGVK, &postgresv1.Postgresql{})

	// Register Flux CRDs with concrete types
	helmReleaseGVK := schema.GroupVersionKind{
		Group:   "helm.toolkit.fluxcd.io",
		Version: "v2",
		Kind:    "HelmRelease",
	}
	r.RegisterCRD(helmReleaseGVK, &helmv2.HelmRelease{})

	helmRepoGVK := schema.GroupVersionKind{
		Group:   "source.toolkit.fluxcd.io",
		Version: "v1",
		Kind:    "HelmRepository",
	}
	r.RegisterCRD(helmRepoGVK, &sourcev1.HelmRepository{})

	mocoGVK := schema.GroupVersionKind{
		Group:   "moco.cybozu.com",
		Version: "v1beta2",
		Kind:    "MySQLCluster",
	}
	r.RegisterCRD(mocoGVK, &mocov1beta2.MySQLCluster{})

	// Moco backup policy
	mocoBackupPolicyGVK := schema.GroupVersionKind{
		Group:   "moco.cybozu.com",
		Version: "v1beta2",
		Kind:    "BackupPolicy",
	}
	r.RegisterCRD(mocoBackupPolicyGVK, &mocov1beta2.BackupPolicy{})

	return r
}

// RenderContext holds the data for definition rendering
type RenderContext struct {
	// Service info
	Name      string
	Namespace string
	TeamID    string

	// Definition info
	Definition Definition

	// Parameters from service
	Parameters map[string]any

	// RFC3339 time format constant for templates
	RFC3339 string
}

// Render renders a definition to YAML string that can be applied to Kubernetes
func (r *DatabaseRenderer) Render(unbindDefinition *Definition, context *RenderContext) (string, error) {
	// Apply defaults to parameters
	context.Parameters = r.applyDefaults(context.Parameters, unbindDefinition.Schema)

	// Set definition info
	context.Definition.Name = unbindDefinition.Name
	context.Definition.Category = unbindDefinition.Category
	context.Definition.Version = unbindDefinition.Version
	context.Definition.Type = unbindDefinition.Type
	context.Definition.Port = unbindDefinition.Port

	// Set RFC3339 constant for time formatting
	context.RFC3339 = time.RFC3339

	// Copy chart info if available
	if unbindDefinition.Chart != nil {
		context.Definition.Chart = unbindDefinition.Chart
	}

	// Special handling for Helm chart type
	if unbindDefinition.Type == "helm" {
		return r.renderHelmChart(unbindDefinition, context)
	}

	// Process definition
	var buf bytes.Buffer
	funcMap := sprig.FuncMap()

	// Add time-related functions
	funcMap["timeFormat"] = func(format string, t time.Time) string {
		return t.Format(format)
	}

	// Add secure password generation function using UUID
	funcMap["generatePassword"] = func(length int) string {
		// Generate a UUID and remove hyphens
		pass := strings.ReplaceAll(uuid.New().String(), "-", "")

		// If requested length is longer than UUID, concatenate multiple UUIDs
		for len(pass) < length {
			pass += strings.ReplaceAll(uuid.New().String(), "-", "")
		}

		// Trim to requested length
		return pass[:length]
	}

	tmpl, err := template.New("definition").Funcs(funcMap).Parse(unbindDefinition.Content)
	if err != nil {
		return "", fmt.Errorf("definition parsing error: %w", err)
	}

	if err := tmpl.Execute(&buf, context); err != nil {
		return "", fmt.Errorf("definition execution error: %w", err)
	}

	return buf.String(), nil
}

// renderHelmChart renders a Helm chart definition
func (r *DatabaseRenderer) renderHelmChart(unbindDefinition *Definition, context *RenderContext) (string, error) {
	// First render the template to get the Helm values
	var buf bytes.Buffer
	tmpl, err := template.New("helm-values").Funcs(sprig.FuncMap()).Parse(unbindDefinition.Content)
	if err != nil {
		return "", fmt.Errorf("helm values parsing error: %w", err)
	}

	if err := tmpl.Execute(&buf, context); err != nil {
		return "", fmt.Errorf("helm values execution error: %w", err)
	}

	// Parse the rendered values YAML
	values := make(map[string]any)
	err = yaml.Unmarshal(buf.Bytes(), &values)
	if err != nil {
		return "", fmt.Errorf("error parsing Helm values: %w", err)
	}

	var chartName, chartVersion, repositoryURL, repositoryName string
	if context.Definition.Chart != nil {
		if context.Definition.Chart.Name != "" {
			chartName = context.Definition.Chart.Name
		}
		if context.Definition.Chart.Version != "" {
			chartVersion = context.Definition.Chart.Version
		}
		if context.Definition.Chart.Repository != "" {
			repositoryURL = context.Definition.Chart.Repository
		}
		if context.Definition.Chart.RepositoryName != "" {
			repositoryName = context.Definition.Chart.RepositoryName
		}
	} else {
		return "", fmt.Errorf("chart information is missing in the definition")
	}

	// Create a Helm release custom resource
	helmRelease := map[string]any{
		"apiVersion": "helm.toolkit.fluxcd.io/v2",
		"kind":       "HelmRelease",
		"metadata": map[string]any{
			"name":      context.Name,
			"namespace": context.Namespace,
			"labels": map[string]string{
				"unbind/usd-type":     context.Definition.Type,
				"unbind/usd-version":  context.Definition.Version,
				"unbind/usd-category": "databases",
			},
		},
		"spec": map[string]any{
			"chart": map[string]any{
				"spec": map[string]any{
					"chart":   chartName,
					"version": chartVersion,
					"sourceRef": map[string]any{
						"kind": "HelmRepository",
						"name": repositoryName,
					},
				},
			},
			"interval": "1m",
			"values":   values,
		},
	}

	helmRepoSpec := map[string]any{
		"url":      repositoryURL,
		"interval": "1h",
	}

	if strings.HasPrefix(repositoryURL, "oci://") {
		helmRepoSpec["type"] = "oci"
	}

	// Add the Helm repository CR
	helmRepo := map[string]any{
		"apiVersion": "source.toolkit.fluxcd.io/v1",
		"kind":       "HelmRepository",
		"metadata": map[string]any{
			"name":      repositoryName,
			"namespace": context.Namespace,
		},
		"spec": helmRepoSpec,
	}

	// Convert both resources to YAML
	helmReleaseYAML, err := yaml.Marshal(helmRelease)
	if err != nil {
		return "", fmt.Errorf("error marshaling Helm release: %w", err)
	}

	helmRepoYAML, err := yaml.Marshal(helmRepo)
	if err != nil {
		return "", fmt.Errorf("error marshaling Helm repository: %w", err)
	}

	// Combine the YAMLs with a separator
	return fmt.Sprintf("---\n%s\n---\n%s", string(helmRepoYAML), string(helmReleaseYAML)), nil
}

// RenderToObjects parses the rendered YAML into Kubernetes objects
func (r *DatabaseRenderer) RenderToObjects(renderedYAML string) ([]runtime.Object, error) {
	var resources []runtime.Object
	decoder := serializer.NewCodecFactory(r.scheme).UniversalDeserializer()

	// Split YAML documents
	docs := strings.Split(renderedYAML, "---")
	for _, doc := range docs {
		doc = strings.TrimSpace(doc)
		if doc == "" {
			continue
		}

		// First try to decode using scheme-aware decoder
		obj, _, err := decoder.Decode([]byte(doc), nil, nil)
		if err == nil {
			resources = append(resources, obj)
			continue
		}

		// Fall back to unstructured decoding
		// If we haven't called RegisterCRD - this is where we end up
		unstObj, err := r.decodeToUnstructured(doc)
		if err != nil {
			return nil, fmt.Errorf("failed to decode resource: %w", err)
		}

		resources = append(resources, unstObj)
	}

	return resources, nil
}

// decodeToUnstructured decodes a YAML document to an unstructured.Unstructured object
func (r *DatabaseRenderer) decodeToUnstructured(doc string) (*unstructured.Unstructured, error) {
	obj := &unstructured.Unstructured{}

	reader := strings.NewReader(doc)
	decoder := yamlDecoder.NewYAMLOrJSONDecoder(reader, 4096)

	if err := decoder.Decode(obj); err != nil {
		return nil, err
	}

	// Verify it's a valid Kubernetes resource with apiVersion and kind
	if obj.GetAPIVersion() == "" || obj.GetKind() == "" {
		return nil, fmt.Errorf("resource is missing apiVersion and/or kind")
	}

	return obj, nil
}

// RegisterCRD registers a custom resource definition with the renderer
// For custom CRDs it enabled better validation
func (r *DatabaseRenderer) RegisterCRD(gvk schema.GroupVersionKind, obj runtime.Object) {
	// Add the type to the scheme
	r.scheme.AddKnownTypeWithName(gvk, obj)

	// Add the list type if appropriate
	r.scheme.AddKnownTypeWithName(
		schema.GroupVersionKind{Group: gvk.Group, Version: gvk.Version, Kind: gvk.Kind + "List"},
		&unstructured.UnstructuredList{})
}

// Validate validates parameters against the schema
func (r *DatabaseRenderer) Validate(params map[string]any, schema DefinitionParameterSchema) error {
	// Check required fields
	for _, required := range schema.Required {
		if _, ok := params[required]; !ok {
			return fmt.Errorf("missing required field: %s", required)
		}
	}

	// Validate each field
	for name, value := range params {
		prop, ok := schema.Properties[name]
		if !ok {
			return fmt.Errorf("unknown field: %s", name)
		}

		if err := r.validateProperty(name, value, prop); err != nil {
			return err
		}
	}

	return nil
}

// validateProperty validates a property against its schema
func (r *DatabaseRenderer) validateProperty(name string, value any, prop ParameterProperty) error {
	// Skip validation if value is nil
	if value == nil {
		return nil
	}

	// Type checking
	switch prop.Type {
	case "string":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("field %s must be a string", name)
		}

		// Enum validation
		if len(prop.Enum) > 0 {
			strValue := value.(string)
			valid := false
			for _, enum := range prop.Enum {
				if strValue == enum {
					valid = true
					break
				}
			}
			if !valid {
				return fmt.Errorf("field %s must be one of: %v", name, prop.Enum)
			}
		}
	case "integer", "number":
		// Convert to float for comparison
		var floatVal float64
		switch v := value.(type) {
		case int:
			floatVal = float64(v)
		case int32:
			floatVal = float64(v)
		case int64:
			floatVal = float64(v)
		case float32:
			floatVal = float64(v)
		case float64:
			floatVal = v
		default:
			return fmt.Errorf("field %s must be a number", name)
		}

		// Range validation
		if prop.Minimum != nil && floatVal < *prop.Minimum {
			return fmt.Errorf("field %s must be >= %v", name, *prop.Minimum)
		}
		if prop.Maximum != nil && floatVal > *prop.Maximum {
			return fmt.Errorf("field %s must be <= %v", name, *prop.Maximum)
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("field %s must be a boolean", name)
		}
	case "object":
		objValue, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("field %s must be an object", name)
		}

		// Validate nested properties if defined
		if prop.Properties != nil {
			for propName, propValue := range objValue {
				nestedProp, ok := prop.Properties[propName]
				if !ok {
					// If not in properties but we have additionalProperties, validate against that
					if prop.AdditionalProperties != nil {
						if err := r.validateProperty(fmt.Sprintf("%s.%s", name, propName), propValue, *prop.AdditionalProperties); err != nil {
							return err
						}
						continue
					}
					return fmt.Errorf("unknown field: %s.%s", name, propName)
				}

				if err := r.validateProperty(fmt.Sprintf("%s.%s", name, propName), propValue, nestedProp); err != nil {
					return err
				}
			}
		} else if prop.AdditionalProperties != nil {
			// If no properties but we have additionalProperties, validate all fields against additionalProperties
			for propName, propValue := range objValue {
				if err := r.validateProperty(fmt.Sprintf("%s.%s", name, propName), propValue, *prop.AdditionalProperties); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// applyDefaults applies default values from the schema
func (r *DatabaseRenderer) applyDefaults(params map[string]any, schema DefinitionParameterSchema) map[string]any {
	result := make(map[string]any)

	// Copy all provided parameters
	for k, v := range params {
		result[k] = v
	}

	// Apply defaults recursively for all properties in the schema
	r.applyDefaultsRecursive(result, schema.Properties, "")

	return result
}

// applyDefaultsRecursive applies defaults recursively
func (r *DatabaseRenderer) applyDefaultsRecursive(params map[string]any, properties map[string]ParameterProperty, prefix string) {
	for name, prop := range properties {
		fullName := name
		if prefix != "" {
			fullName = prefix + "." + name
		}

		parts := strings.Split(fullName, ".")
		paramMap := params

		// Navigate to the correct nested map for deeply nested properties
		for i := 0; i < len(parts)-1; i++ {
			part := parts[i]

			// Create path if it doesn't exist
			if _, exists := paramMap[part]; !exists {
				paramMap[part] = make(map[string]any)
			}

			var ok bool
			paramMap, ok = paramMap[part].(map[string]any)
			if !ok {
				// If it's not a map, we can't proceed further with this path
				break
			}
		}

		lastPart := parts[len(parts)-1]

		// Apply default for this property if not set
		if _, exists := paramMap[lastPart]; !exists && prop.Default != nil {
			paramMap[lastPart] = prop.Default
		}

		// Recursively apply defaults to nested objects
		if prop.Type == "object" && prop.Properties != nil {
			// Ensure the object exists
			if _, exists := paramMap[lastPart]; !exists {
				paramMap[lastPart] = make(map[string]any)
			}

			// Get the nested object
			if nestedMap, ok := paramMap[lastPart].(map[string]any); ok {
				r.applyDefaultsRecursive(nestedMap, prop.Properties, "")
			}
		}
	}
}
