package templates

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
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
				Default:     utils.ToPtr("1"),
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
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "STATIC_VAR",
						Value: "static-value",
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
	assert.Len(t, service.Variables, 3)

	// Verify static variable is preserved
	staticVar := findVariable(service.Variables, "STATIC_VAR")
	require.NotNil(t, staticVar)
	assert.Equal(t, "static-value", staticVar.Value)
	assert.Nil(t, staticVar.Generator)

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
