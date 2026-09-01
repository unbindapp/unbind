package templates

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestResolveTemplate(t *testing.T) {
	// Create a test template with static, generated, string replace variables, and volumes
	template := &schema.TemplateDefinition{
		Name:        "test-template",
		Description: "Test template",
		Version:     1,
		Inputs: []schema.TemplateInput{
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "test-data",
					MountPath: "/data",
				},
				Description: "Size of the storage for the test data.",
				Required:    true,
				Default:     new("1"),
			},
			{
				ID:          "input_test_value",
				Name:        "Test Value",
				Type:        schema.InputTypeVariable,
				Description: "A user-supplied value.",
				Required:    true,
			},
		},
		Services: []schema.TemplateService{
			{
				ID:      "service_testservice",
				Name:    "TestService",
				Type:    schema.ServiceTypeDockerimage,
				Builder: schema.ServiceBuilderDocker,
				InputIDs: []string{
					"input_storage_size",
					"input_test_value",
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "STATIC_VAR",
						Value: "static-value",
					},
					{
						Name: "INPUT_VAR",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_test_value",
							AddPrefix: "prefix-",
						},
					},
					{
						Name: "GENERATED_PASSWORD",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
					{
						Name: "STRING_REPLACE_VAR",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypeStringReplace,
						},
						Value: "postgres://user:${SERVICE_TESTSERVICE_GENERATED_PASSWORD}@${SERVICE_TESTSERVICE_KUBE_NAME}.${NAMESPACE}:5432/postgres",
					},
				},
			},
		},
	}

	templater := NewTemplater(&config.Config{
		ExternalUIUrl: "https://example.com",
	})

	// Test template resolution
	inputs := map[string]string{
		"input_storage_size": "2",
		"input_test_value":   "user-value",
	}
	kubeNameMap := map[string]string{
		"service_testservice": "test-service",
	}
	namespace := "test-namespace"

	resolved, err := templater.ResolveTemplate(template, inputs, kubeNameMap, namespace)
	require.NoError(t, err)
	require.NotNil(t, resolved)

	// Verify template structure is preserved
	assert.Equal(t, template.Name, resolved.Name)
	assert.Equal(t, template.Description, resolved.Description)
	assert.Equal(t, template.Version, resolved.Version)
	assert.Len(t, resolved.Services, 1)

	// Get the service and its variables
	service := resolved.Services[0]
	assert.Equal(t, template.Services[0].Name, service.Name)
	assert.Equal(t, template.Services[0].Type, service.Type)
	assert.Equal(t, template.Services[0].Builder, service.Builder)
	assert.Len(t, service.Variables, 4)

	// Verify static variable is preserved
	staticVar := findVariable(service.Variables, "STATIC_VAR")
	require.NotNil(t, staticVar)
	assert.Equal(t, "static-value", staticVar.Value)
	assert.Nil(t, staticVar.Generator)

	// Verify input variable resolves to the user-supplied value
	inputVar := findVariable(service.Variables, "INPUT_VAR")
	require.NotNil(t, inputVar)
	assert.Equal(t, "prefix-user-value", inputVar.Value)

	// Verify password is generated
	passwordVar := findVariable(service.Variables, "GENERATED_PASSWORD")
	require.NotNil(t, passwordVar)
	assert.NotEmpty(t, passwordVar.Value)
	assert.Len(t, passwordVar.Value, 32) // Default password length

	// Verify string replace variable is preserved and replaced
	stringReplaceVar := findVariable(service.Variables, "STRING_REPLACE_VAR")
	require.NotNil(t, stringReplaceVar)
	assert.Contains(t, stringReplaceVar.Value, "postgres://user:")
	assert.Contains(t, stringReplaceVar.Value, "@test-service.test-namespace:5432/postgres")
	assert.NotNil(t, stringReplaceVar.Generator)
	assert.Equal(t, schema.GeneratorTypeStringReplace, stringReplaceVar.Generator.Type)

	// Verify volume resolution
	require.Len(t, service.Volumes, 1)
	volume := service.Volumes[0]
	assert.Equal(t, "test-data", volume.Name)
	assert.Equal(t, "2Gi", volume.CapacityGB)
	assert.Equal(t, "/data", volume.MountPath)
}

// Helper function to find a variable by name
func findVariable(vars []schema.TemplateVariable, name string) *schema.TemplateVariable {
	for _, v := range vars {
		if v.Name == name {
			return &v
		}
	}
	return nil
}

// Storage sliders step in fractions of a GiB (0.1 GiB minimum, 0.25 GiB steps on the local-path
// provisioner), so a value like "10.1" must round to whole mebibytes rather than be handed to
// Kubernetes as the unrepresentable "10.1Gi".
func TestResolveTemplateFractionalStorageSizes(t *testing.T) {
	newTemplate := func() *schema.TemplateDefinition {
		return &schema.TemplateDefinition{
			Name:    "test-template",
			Version: 1,
			Inputs: []schema.TemplateInput{
				{
					ID:   "input_storage_size",
					Name: "Storage Size",
					Type: schema.InputTypeVolumeSize,
					Volume: &schema.TemplateVolume{
						Name:      "test-data",
						MountPath: "/data",
					},
					Required: true,
				},
				{
					ID:       "input_database_size",
					Name:     "Database Size",
					Type:     schema.InputTypeDatabaseSize,
					Required: true,
				},
			},
			Services: []schema.TemplateService{
				{
					ID:       "service_testservice",
					Name:     "TestService",
					Type:     schema.ServiceTypeDockerimage,
					Builder:  schema.ServiceBuilderDocker,
					InputIDs: []string{"input_storage_size", "input_database_size"},
				},
			},
		}
	}

	templater := NewTemplater(&config.Config{ExternalUIUrl: "https://example.com"})
	kubeNameMap := map[string]string{"service_testservice": "test-service"}

	tests := []struct {
		input    string
		expected string
	}{
		{input: "10.1", expected: "10342Mi"},
		{input: "0.1", expected: "102Mi"},
		{input: "5", expected: "5Gi"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			resolved, err := templater.ResolveTemplate(newTemplate(), map[string]string{
				"input_storage_size":  tt.input,
				"input_database_size": tt.input,
			}, kubeNameMap, "test-namespace")
			require.NoError(t, err)

			service := resolved.Services[0]
			require.Len(t, service.Volumes, 1)
			assert.Equal(t, tt.expected, service.Volumes[0].CapacityGB)
			require.NotNil(t, service.DatabaseConfig)
			assert.Equal(t, tt.expected, service.DatabaseConfig.StorageSize)
		})
	}
}
