package variables_service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
)

func (self *VariablesService) ResolveSingleReference(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, serviceID, referenceID uuid.UUID) (string, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   serviceID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return "", err
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return "", err
	}

	// Get the reference
	reference, err := self.repo.Variables().GetReferenceByID(ctx, referenceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Variable reference not found")
		}
		return "", err
	}
	if reference.TargetServiceID != serviceID {
		return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Variable reference not found")
	}

	// Get the namespace
	namespace, err := self.repo.Service().GetDeploymentNamespace(ctx, serviceID)
	if err != nil {
		return "", err
	}
	return self.resolveReference(ctx, client, namespace, reference)
}

// Resolve variable references into map[string]string
func (self *VariablesService) ResolveAllReferences(ctx context.Context, serviceID uuid.UUID) (map[string]string, error) {
	// Get all references
	result := make(map[string]string)
	references, err := self.repo.Variables().GetReferencesForService(ctx, serviceID)
	if err != nil {
		return nil, err
	}

	if len(references) == 0 {
		return result, nil
	}

	// Get team namespace
	namespace, err := self.repo.Service().GetDeploymentNamespace(ctx, serviceID)
	if err != nil {
		return nil, err
	}

	// Get our meta client
	client := self.k8s.GetInternalClient()

	for _, reference := range references {
		// Resolve the reference
		value, err := self.resolveReference(ctx, client, namespace, reference)
		if err != nil {
			return nil, err
		}

		// Add to our result map
		result[reference.TargetName] = value
	}

	return result, nil
}

func (self *VariablesService) resolveSourceValue(ctx context.Context, client kubernetes.Interface, namespace string, source schema.VariableReferenceSource) (string, error) {
	switch source.Type {
	case schema.VariableReferenceTypeVariable:
		// Get from kubernetes secret
		secret, err := self.k8s.GetSecret(ctx, source.SourceKubernetesName, namespace, client)
		if err != nil {
			if errors.IsNotFound(err) {
				return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("Variable not found: %s", source.SourceKubernetesName))
			}
			return "", err
		}

		// Get the value from the secret
		value, ok := secret.Data[source.Key]
		if !ok {
			return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("Key not found in variable: %s", source.Key))
		}
		return string(value), nil

	case schema.VariableReferenceTypeInternalEndpoint, schema.VariableReferenceTypeExternalEndpoint:
		endpoints, err := self.k8s.DiscoverEndpointsByLabels(ctx, namespace,
			map[string]string{
				source.SourceType.KubernetesLabel(): source.SourceID.String(),
			}, false, client)
		if err != nil {
			return "", err
		}

		if len(endpoints.Internal) == 0 && len(endpoints.External) == 0 {
			return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Endpoint not found")
		}

		if source.Type == schema.VariableReferenceTypeInternalEndpoint {
			for _, endpoint := range endpoints.Internal {
				if endpoint.KubernetesName == source.Key {
					return self.resolveInternalEndpointURL(ctx, client, namespace, source, endpoint)
				}
			}
		} else {
			// External endpoint
			for _, endpoint := range endpoints.External {
				if endpoint.Host == source.Key {
					return fmt.Sprintf("https://%s", endpoint.Host), nil
				}
			}
		}
	}

	return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("Unable to resolve %s.%s", source.SourceKubernetesName, source.Key))
}

// Helper function to resolve internal endpoint URL
func (self *VariablesService) resolveInternalEndpointURL(ctx context.Context, client kubernetes.Interface, namespace string, source schema.VariableReferenceSource, endpoint models.ServiceEndpoint) (string, error) {
	// Figure out port
	var targetPort *schema.PortSpec
	for _, port := range endpoint.Ports {
		if port.Protocol != nil && *port.Protocol == schema.ProtocolTCP {
			targetPort = &port
			break
		}
	}
	if targetPort == nil {
		return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "No TCP port found for endpoint")
	}

	// Query service type
	databaseType, err := self.repo.Service().GetDatabaseType(ctx, endpoint.ServiceID)
	if err != nil {
		log.Errorf("Failed to get database type for endpoint %s: %v", endpoint.KubernetesName, err)
		return "", err
	}

	switch databaseType {
	case "":
		return fmt.Sprintf("http://%s:%d", endpoint.DNS, targetPort.Port), nil
	default:
		// Omit port from databases as its a separate variable
		return endpoint.DNS, nil
	}
}

// resolve reference template
func (self *VariablesService) resolveReference(ctx context.Context, client kubernetes.Interface, namespace string, reference *ent.VariableReference) (string, error) {
	sourceValues := make(map[string]string)
	for _, source := range reference.Sources {
		// The key we want to replace in our template
		sourceKey := fmt.Sprintf("${%s.%s}", source.SourceKubernetesName, source.Key)

		value, err := self.resolveSourceValue(ctx, client, namespace, source)
		if err != nil {
			if referenceErr := self.handleReferenceError(ctx, reference.ID, err); referenceErr != nil {
				return "", referenceErr
			}
			return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("Unable to resolve variable %s ${%s.%s}", reference.TargetName, source.SourceKubernetesName, source.Key))
		}
		sourceValues[sourceKey] = value
	}

	// Replace all references in the template
	template := reference.ValueTemplate
	for k, v := range sourceValues {
		template = strings.ReplaceAll(template, k, v)
	}
	return template, nil
}

// Helper function to handle errors consistently
func (self *VariablesService) handleReferenceError(ctx context.Context, referenceID uuid.UUID, err error) error {
	if _, attachErr := self.repo.Variables().AttachError(ctx, referenceID, err); attachErr != nil {
		log.Errorf("Failed to attach error to variable reference %s: %v", referenceID, attachErr)
		return attachErr
	}
	return nil
}
