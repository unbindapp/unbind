package templates_service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	"github.com/unbindapp/unbind-api/pkg/databases"
	"github.com/unbindapp/unbind-api/pkg/templates"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Also set default resources for database services
var defaultDatabaseResources = &schema.Resources{
	CPURequestsMillicores:   50,
	CPULimitsMillicores:     500,
	MemoryRequestsMegabytes: 128,
	MemoryLimitsMegabytes:   1548,
}

func (self *TemplatesService) DeployTemplate(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.TemplateDeployInput) ([]*models.ServiceResponse, error) {
	// Check permissions
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage teams
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Verify inputs
	_, project, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	// Get the template
	template, err := self.repo.Template().GetByID(ctx, input.TemplateID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Template not found")
		}
		return nil, err
	}

	// Validate template inputs and handle hosts
	hostInputMap, validatedInputs, err := self.resolveHostInputs(ctx, &template.Definition, input.Inputs)
	if err != nil {
		return nil, err
	}

	// * Validate all non-host inputs
	for _, defInput := range template.Definition.Inputs {
		if defInput.Type == schema.InputTypeHost || defInput.Type == schema.InputTypeGeneratedNodePort {
			continue
		}

		// Get value from provided inputs or use default
		var value string
		var exists bool
		for _, inputValue := range input.Inputs {
			if inputValue.ID == defInput.ID {
				value = inputValue.Value
				exists = true
				break
			}
		}

		if !exists {
			if defInput.Default != nil {
				value = *defInput.Default
			} else if defInput.Type == schema.InputTypeGeneratedPassword {
				// Generate a password
				pwd, err := utils.GenerateSecurePassword(32, true)
				if err != nil {
					return nil, err
				}
				value = pwd
			} else if defInput.Required {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("input %s is required", defInput.Name))
			} else {
				continue
			}
		}

		validatedInputs[defInput.ID] = value
	}

	// Generate node ports for node port inputs
	portMap := make(map[string]int32)
	portInputCount := 0
	for _, defInput := range template.Definition.Inputs {
		if defInput.Type == schema.InputTypeGeneratedNodePort {
			portInputCount++
			// Ignore if input already exists
			for _, inputValue := range input.Inputs {
				if inputValue.ID == defInput.ID {
					// Parse as int32
					port, err := strconv.Atoi(inputValue.Value)
					if err != nil {
						return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("invalid node port %s for input %s", inputValue.Value, inputValue.ID))
					}
					portMap[defInput.ID] = int32(port)
					break
				}
			}

			// Generate a port
			nodePort, err := self.k8s.GetUnusedNodePort(ctx)
			if err != nil {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("failed to generate node port: %v", err))
			}
			portMap[defInput.ID] = nodePort
			validatedInputs[defInput.ID] = strconv.Itoa(int(portMap[defInput.ID]))
		}

		// Resolve Node IP inputs
		if defInput.Type == schema.InputTypeGeneratedNodeIP {
			nodes, err := self.k8s.GetInternalClient().CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
			if err != nil {
				return nil, fmt.Errorf("failed to list nodes: %w", err)
			}

			// Sort nodes by created_at desc
			sort.Slice(nodes.Items, func(i, j int) bool {
				return nodes.Items[i].CreationTimestamp.After(nodes.Items[j].CreationTimestamp.Time)
			})

			var nodeIP string
			for _, node := range nodes.Items {
				for _, addr := range node.Status.Addresses {
					if addr.Type == corev1.NodeExternalIP {
						nodeIP = addr.Address
						break
					}
				}
				if nodeIP != "" {
					break
				}
			}

			validatedInputs[defInput.ID] = nodeIP
		}
	}

	if len(portMap) != portInputCount {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "not all node ports were provided")
	}

	// Parse and generate variables
	kubeNameMap := make(map[string]string)

	// Generate kube name map
	for _, service := range template.Definition.Services {
		kubernetesName, err := utils.GenerateSlug(service.Name)
		if err != nil {
			return nil, err
		}
		kubeNameMap[service.ID] = kubernetesName
	}

	templater := templates.NewTemplater(self.cfg)
	generatedTemplate, err := templater.ResolveTemplate(&template.Definition, validatedInputs, kubeNameMap, project.Edges.Team.Namespace)
	if err != nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
	}

	// Make sure we have all our hosts
	for _, svc := range generatedTemplate.Services {
		for _, id := range svc.InputIDs {
			// Skip if this is not a Type host input
			if !self.isHostInput(&template.Definition, id) {
				continue
			}
			if _, ok := hostInputMap[id]; !ok {
				return nil, errdefs.NewCustomError(
					errdefs.ErrTypeInvalidInput,
					fmt.Sprintf("service %q references unresolved host input ID %s", svc.Name, id))
			}
		}
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Create services
	var secretNames []string
	var newServices []*ent.Service
	dbServiceMap := make(map[string]*ent.Service)

	// Generate a launch ID
	templateInstanceID := uuid.New()

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		serviceGroup, err := self.repo.ServiceGroup().Create(ctx, tx, input.GroupName, utils.ToPtr(generatedTemplate.Icon), input.GroupDescription, input.EnvironmentID)
		if err != nil {
			return fmt.Errorf("failed to create service group: %w", err)
		}

		for _, templateService := range generatedTemplate.Services {
			// Fetch DB metadata (if a database)
			var dbVersion *string
			if templateService.Type == schema.ServiceTypeDatabase {
				if templateService.Resources == nil {
					templateService.Resources = defaultDatabaseResources
				}

				// Fetch the template
				dbDefinition, err := self.dbProvider.FetchDatabaseDefinition(ctx, self.cfg.UnbindServiceDefVersion, *templateService.DatabaseType)
				if err != nil {
					if errors.Is(err, databases.ErrDatabaseNotFound) {
						return errdefs.NewCustomError(errdefs.ErrTypeNotFound,
							fmt.Sprintf("Database %s not found", *templateService.DatabaseType))
					}
					return err
				}

				// Nuke whatever they tell us for ports
				templateService.Ports = []schema.PortSpec{
					{
						Port:     int32(dbDefinition.Port),
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				}

				versionProperty, ok := dbDefinition.Schema.Properties["version"]
				if ok {
					dbVersionDefault, _ := versionProperty.Default.(string)
					if dbVersionDefault != "" {
						dbVersion = utils.ToPtr(dbVersionDefault)
					}
				}

				if templateService.DatabaseConfig != nil && templateService.DatabaseConfig.Version != "" {
					if len(versionProperty.Enum) > 0 && !slices.Contains(versionProperty.Enum, templateService.DatabaseConfig.Version) {
						return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Database version %s not found for %s", templateService.DatabaseConfig.Version, *templateService.DatabaseType))
					}
					dbVersion = utils.ToPtr(templateService.DatabaseConfig.Version)
				}

				if dbVersion == nil {
					return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput,
						fmt.Sprintf("Database version not found for %s", *templateService.DatabaseType))
				}

				if templateService.DatabaseConfig == nil {
					templateService.DatabaseConfig = &schema.DatabaseConfig{
						Version: *dbVersion,
					}
				} else {
					templateService.DatabaseConfig.Version = *dbVersion
				}

				// Validate storage quantity
				if templateService.DatabaseConfig.StorageSize != "" {
					templateService.DatabaseConfig.StorageSize = utils.EnsureSuffix(templateService.DatabaseConfig.StorageSize, "Gi")
				}
			}

			kubernetesName, ok := kubeNameMap[templateService.ID]
			if !ok {
				return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("service %q not found", templateService.Name))
			}

			// Create kubernetes secrets
			secret, _, err := self.k8s.GetOrCreateSecret(ctx, kubernetesName, project.Edges.Team.Namespace, client)
			if err != nil {
				return fmt.Errorf("failed to create secret: %v", err)
			}
			secretNames = append(secretNames, secret.Name)

			// Add variables to the secret
			secretData := make(map[string][]byte)
			for _, variable := range templateService.Variables {
				secretData[variable.Name] = []byte(variable.Value)
			}

			// Resolve any references that should be treated as local
			for _, ref := range templateService.VariableReferences {
				if ref.IsHost && ref.ResolveAsNormalVariable {
					// See if we have a kubeNameMap for the source ID
					sourceKubeName, ok := kubeNameMap[ref.SourceID]
					if !ok {
						return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("source service not found for local variable reference %s", ref.TargetName))
					}
					// Add the reference to the secret data
					secretData[ref.TargetName] = fmt.Appendf(nil, "%s.%s", sourceKubeName, project.Edges.Team.Namespace)
				}
			}

			if _, err := self.k8s.UpsertSecretValues(ctx, secret.Name, project.Edges.Team.Namespace, secretData, client); err != nil {
				return fmt.Errorf("failed to update secret values: %v", err)
			}

			// Create the service
			createService, err := self.repo.Service().Create(ctx, tx,
				&service_repo.CreateServiceInput{
					KubernetesName:     kubernetesName,
					ServiceType:        templateService.Type,
					Name:               templateService.Name,
					EnvironmentID:      input.EnvironmentID,
					KubernetesSecret:   secret.Name,
					Database:           templateService.DatabaseType,
					DatabaseVersion:    dbVersion,
					TemplateID:         utils.ToPtr(template.ID),
					TemplateInstanceID: utils.ToPtr(templateInstanceID),
					ServiceGroupID:     utils.ToPtr(serviceGroup.ID),
					DetectedPorts:      templateService.Ports,
				})
			if err != nil {
				return fmt.Errorf("failed to create service: %w", err)
			}
			createService.Edges.ServiceGroup = serviceGroup

			// Create volumes
			var volumes []schema.ServiceVolume
			for _, volume := range templateService.Volumes {
				// Build labels to set
				labels := map[string]string{
					"unbind-team":        input.TeamID.String(),
					"unbind-project":     input.ProjectID.String(),
					"unbind-environment": input.EnvironmentID.String(),
				}

				//  Generate a name
				pvcName, err := utils.GenerateSlug(volume.Name)
				if err != nil {
					return err
				}

				// Create metadata
				err = self.repo.System().UpsertPVCMetadata(
					ctx,
					tx,
					pvcName,
					utils.ToPtr(volume.Name),
					nil,
				)
				if err != nil {
					return err
				}

				// Get the PVCs
				pvc, err := self.k8s.CreatePersistentVolumeClaim(ctx,
					project.Edges.Team.Namespace,
					pvcName,
					volume.Name,
					labels,
					volume.CapacityGB,
					[]corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					nil,
					client,
				)
				if err != nil {
					return err
				}
				pvc.Name = volume.Name

				// Append
				volumes = append(volumes, schema.ServiceVolume{
					ID:        pvc.ID,
					MountPath: volume.MountPath,
				})
			}

			var hosts []schema.HostSpec
			for _, hostInputID := range templateService.InputIDs {
				// Skip if this is not a Type host input
				if !self.isHostInput(&template.Definition, hostInputID) {
					continue
				}
				hostSpec, exists := hostInputMap[hostInputID]
				if !exists {
					return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "host input not found")
				}
				// Count domain collisions
				domainCount, err := self.repo.Service().CountDomainCollisons(ctx, tx, hostSpec.Host, nil)
				if err != nil {
					return fmt.Errorf("failed to count domain collisions: %w", err)
				}
				if domainCount > 0 {
					return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("domain %s already in use", hostSpec.Host))
				}
				hosts = append(hosts, hostSpec)
			}

			// Create the service config
			var isPublic *bool
			for _, inputID := range templateService.InputIDs {
				if self.isHostInput(&template.Definition, inputID) {
					isPublic = utils.ToPtr(true)
					break
				}
			}
			createInput := &service_repo.MutateConfigInput{
				ServiceID:               createService.ID,
				Builder:                 utils.ToPtr(templateService.Builder),
				OverwritePorts:          templateService.Ports,
				OverwriteHosts:          hosts,
				Replicas:                utils.ToPtr[int32](1),
				Public:                  isPublic,
				DatabaseConfig:          templateService.DatabaseConfig,
				Image:                   templateService.Image,
				CustomDefinitionVersion: utils.ToPtr(self.cfg.UnbindServiceDefVersion),
				OverwriteVolumes:        volumes,
				RunCommand:              templateService.RunCommand,
				SecurityContext:         templateService.SecurityContext,
				HealthCheck:             templateService.HealthCheck,
				OverwriteVariableMounts: templateService.VariablesMounts,
				InitContainers:          templateService.InitContainers,
				Resources:               templateService.Resources,
			}

			serviceConfig, err := self.repo.Service().CreateConfig(ctx, tx, createInput)
			if err != nil {
				return fmt.Errorf("failed to create service config: %w", err)
			}
			createService.Edges.ServiceConfig = serviceConfig

			// Append
			newServices = append(newServices, createService)
			dbServiceMap[templateService.ID] = createService
		}

		// Resolve variable references
		for _, templateService := range generatedTemplate.Services {
			referenceInput := []*models.VariableReferenceInputItem{}
			for _, variableReference := range templateService.VariableReferences {
				if variableReference.ResolveAsNormalVariable {
					continue
				}
				// Get source
				sourceService := dbServiceMap[variableReference.SourceID]
				if sourceService == nil {
					log.Error("failed to find service for variable reference", "serviceID", variableReference.SourceID, "template", templateService.Name)
					return fmt.Errorf("failed to find service for variable reference: %w", err)
				}

				// Deal with is_host first, not really a reference just resolved on the fly
				if variableReference.IsHost {
					// Determine the host key (it may not exist yet so we can't DNS lookup)
					key := sourceService.KubernetesName

					if sourceService.Type == schema.ServiceTypeDatabase && sourceService.Database != nil {
						// Special DB cases
						switch *sourceService.Database {
						case "mysql":
							// Moco primary instance
							key = fmt.Sprintf("moco-%s-primary", key)
						case "redis":
							key = fmt.Sprintf("%s-headless", key)
						case "clickhouse":
							key = fmt.Sprintf("clickhouse-%s", key)
						}
					}

					// Host Refs
					referenceInput = append(referenceInput, &models.VariableReferenceInputItem{
						Name: variableReference.TargetName,
						Sources: []schema.VariableReferenceSource{
							{
								Type:                 schema.VariableReferenceTypeInternalEndpoint,
								SourceName:           sourceService.Name,
								SourceIcon:           sourceService.Edges.ServiceConfig.Icon,
								SourceID:             sourceService.ID,
								SourceType:           schema.VariableReferenceSourceTypeService,
								SourceKubernetesName: sourceService.KubernetesName,
								Key:                  key,
							},
						},
						Value: fmt.Sprintf("${%s.%s}", sourceService.KubernetesName, key),
					})

					continue
				}

				// Standard variable references
				value := fmt.Sprintf("${%s.%s}", sourceService.KubernetesName, variableReference.SourceName)
				sources := []schema.VariableReferenceSource{
					{
						Type:                 schema.VariableReferenceTypeVariable,
						SourceName:           sourceService.Name,
						SourceIcon:           sourceService.Edges.ServiceConfig.Icon,
						SourceID:             sourceService.ID,
						SourceType:           schema.VariableReferenceSourceTypeService,
						SourceKubernetesName: sourceService.KubernetesName,
						Key:                  variableReference.SourceName,
					},
				}
				if variableReference.TemplateString != "" {
					// Replace the key with the right one
					value = strings.ReplaceAll(variableReference.TemplateString, fmt.Sprintf("${%s}", variableReference.SourceName), fmt.Sprintf("${%s.%s}", sourceService.KubernetesName, variableReference.SourceName))
					if len(variableReference.AdditionalTemplateSources) > 0 {
						for _, additionalSource := range variableReference.AdditionalTemplateSources {
							sources = append(sources, schema.VariableReferenceSource{
								Type:                 schema.VariableReferenceTypeVariable,
								SourceName:           sourceService.Name,
								SourceIcon:           sourceService.Edges.ServiceConfig.Icon,
								SourceID:             sourceService.ID,
								SourceType:           schema.VariableReferenceSourceTypeService,
								SourceKubernetesName: sourceService.KubernetesName,
								Key:                  additionalSource,
							})

							value = strings.ReplaceAll(value, fmt.Sprintf("${%s}", additionalSource), fmt.Sprintf("${%s.%s}", sourceService.KubernetesName, additionalSource))
						}
					}
				}
				referenceInput = append(referenceInput, &models.VariableReferenceInputItem{
					Name:    variableReference.TargetName,
					Sources: sources,
					Value:   value,
				})
			}

			if len(referenceInput) > 0 {
				targetService := dbServiceMap[templateService.ID]
				if targetService == nil {
					log.Error("failed to find service for variable reference", "targetID", templateService.ID)
					return fmt.Errorf("failed to find service for variable reference: %w", err)
				}
				_, err := self.repo.Variables().UpdateReferences(ctx, tx, models.VariableUpdateBehaviorUpsert, targetService.ID, referenceInput)
				if err != nil {
					if ent.IsConstraintError(err) {
						return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Variable reference already exists")
					}
					return err
				}
			}
		}

		return nil
	}); err != nil {
		// Attempt to delete the created secrets
		for _, secretName := range secretNames {
			if err := self.k8s.DeleteSecret(ctx, secretName, project.Edges.Team.Namespace, client); err != nil {
				log.Error("failed to delete secret", "secretName", secretName, "error", err)
			}
		}

		return nil, err
	}

	// Deploy all services without variable references
	for _, service := range generatedTemplate.Services {
		// Get the service from our map
		dbService := dbServiceMap[service.ID]

		// Populate build environment
		env, err := self.deployCtl.PopulateBuildEnvironment(ctx, dbService.ID, nil, nil)
		if err != nil {
			return nil, err
		}

		// Create deployment request
		deployReq := deployctl.DeploymentJobRequest{
			ServiceID:   dbService.ID,
			Environment: env,
			Source:      schema.DeploymentSourceManual,
		}

		// If service has dependencies, add to dependent queue
		var deployment *ent.Deployment
		var dependentServiceIDs []uuid.UUID
		for _, dep := range service.DependsOn {
			if service, ok := dbServiceMap[dep]; ok {
				dependentServiceIDs = append(dependentServiceIDs, service.ID)
			} else {
				log.Warn("dependency service not© found in map", "serviceID", dep, "templateServiceID", service.ID)
			}
		}
		deployReq.DependsOnServiceIDs = dependentServiceIDs
		if len(service.VariableReferences) > 0 {
			deployment, err = self.deployCtl.EnqueueDependentDeployment(ctx, deployReq)
		} else {
			// Otherwise deploy immediately
			deployment, err = self.deployCtl.EnqueueDeploymentJob(ctx, deployReq)
		}

		if err != nil {
			return nil, err
		}

		// Find it in newServices
		for i := range newServices {
			if newServices[i].ID == dbService.ID {
				newServices[i].Edges.CurrentDeployment = deployment
				newServices[i].Edges.Deployments = []*ent.Deployment{deployment}
				break
			}
		}
	}

	return models.TransformServiceEntities(newServices), nil
}

// returns: map[inputID]HostSpec, map[inputID]string (value to hand to the templater)
func (self *TemplatesService) resolveHostInputs(
	ctx context.Context,
	tmpl *schema.TemplateDefinition,
	rawInputs []models.TemplateInputValue,
) (map[string]schema.HostSpec, map[string]string, error) {
	hostSpecByID := make(map[string]schema.HostSpec)
	valueByID := make(map[string]string)

	for _, in := range tmpl.Inputs {
		if in.Type != schema.InputTypeHost {
			continue
		}

		// 1. find a value (provided → default → "")
		var hostVal string
		for _, u := range rawInputs {
			if u.ID == in.ID {
				hostVal = u.Value
				break
			}
		}

		// 2. if we still have nothing AND it's required → try generate
		if hostVal == "" && in.Required {
			// generateWildcardHost needs *one* service / port context – first match wins
			genForSvc := (*schema.TemplateService)(nil)
			var targetPort *int32
			for _, svc := range tmpl.Services {
				for _, id := range svc.InputIDs {
					// skip if this is not a Type host input
					if !self.isHostInput(tmpl, id) {
						continue
					}
					if id == in.ID {
						genForSvc = &svc
						break
					}
				}
				if genForSvc != nil {
					break
				}
			}
			if genForSvc == nil {
				return nil, nil, errdefs.NewCustomError(
					errdefs.ErrTypeInvalidInput,
					fmt.Sprintf("no service refers to required host input %q", in.Name))
			}

			if in.TargetPort != nil {
				p := int32(*in.TargetPort)
				targetPort = &p
			} else if len(genForSvc.Ports) > 0 {
				targetPort = &genForSvc.Ports[0].Port
			}
			kubename, _ := utils.GenerateSlug(genForSvc.Name)
			spec, err := self.generateWildcardHost(ctx, nil, kubename, genForSvc.Ports, targetPort)
			if err != nil {
				return nil, nil, err
			}
			hostVal = spec.Host
			hostSpecByID[in.ID] = *spec // we already have the full spec
			valueByID[in.ID] = hostVal
			continue
		}

		// 3. we have a hostVal from user / default – clean & store
		if hostVal != "" {
			cleaned, err := utils.CleanAndValidateHost(hostVal)
			if err != nil {
				return nil, nil, errdefs.NewCustomError(
					errdefs.ErrTypeInvalidInput,
					fmt.Sprintf("invalid host for input %q: %v", in.Name, err))
			}
			hostVal = cleaned
			// pick a port (targetPort or first port of *any* svc using this input)
			var port *int32
			if in.TargetPort != nil {
				p := int32(*in.TargetPort)
				port = &p
			} else {
				for _, svc := range tmpl.Services {
					for _, id := range svc.InputIDs {
						// skip if this is not a Type host input
						if !self.isHostInput(tmpl, id) {
							continue
						}
						if id == in.ID && len(svc.Ports) > 0 {
							port = &svc.Ports[0].Port
							break
						}
					}
					if port != nil {
						break
					}
				}
			}
			hostSpecByID[in.ID] = schema.HostSpec{Host: hostVal, Path: "/", TargetPort: port}
			valueByID[in.ID] = hostVal
		}
	}
	return hostSpecByID, valueByID, nil
}

func (self *TemplatesService) isHostInput(def *schema.TemplateDefinition, inputID string) bool {
	for _, defInput := range def.Inputs {
		if inputID == defInput.ID {
			return defInput.Type == schema.InputTypeHost
		}
	}
	return false
}

func (self *TemplatesService) generateWildcardHost(ctx context.Context, tx repository.TxInterface, kubernetesName string, ports []schema.PortSpec, targetPort *int32) (*schema.HostSpec, error) {
	settings, err := self.repo.System().GetSystemSettings(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("failed to get system settings: %w", err)
	}

	if settings.WildcardBaseURL == nil || *settings.WildcardBaseURL == "" {
		return nil, nil // No wildcard base URL configured
	}

	domain, err := utils.GenerateSubdomain(kubernetesName, *settings.WildcardBaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate subdomain: %w", err)
	}

	domainCount, err := self.repo.Service().CountDomainCollisons(ctx, tx, domain, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to count domain collisions: %w", err)
	}

	if domainCount > 0 {
		domain, err = utils.GenerateSubdomain(fmt.Sprintf("%s-%d", kubernetesName, domainCount), *settings.WildcardBaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to generate subdomain with suffix: %w", err)
		}
	}

	// Use targetPort if provided, otherwise use the first port from ports
	port := targetPort
	if port == nil && len(ports) > 0 {
		port = utils.ToPtr(ports[0].Port)
	}

	return &schema.HostSpec{
		Host:       domain,
		Path:       "/",
		TargetPort: port,
	}, nil
}
