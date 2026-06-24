package resourcebuilder

import (
	"context"
	"fmt"
	"strings"

	"github.com/go-logr/logr"
	"github.com/unbindapp/unbind-api/pkg/databases"
	"k8s.io/apimachinery/pkg/runtime"
)

func (rb *ResourceBuilder) BuildDatabaseObjects(ctx context.Context, logger logr.Logger) ([]runtime.Object, error) {
	dbProvider := databases.NewDatabaseProvider()
	dbRenderer := databases.NewDatabaseRenderer()

	fetchedDb, err := dbProvider.FetchDatabaseDefinition(ctx,
		rb.service.Spec.Config.Database.DatabaseSpecVersion,
		rb.service.Spec.Config.Database.Type,
	)
	if err != nil || fetchedDb == nil {
		logger.Error(err, "Failed to fetch database")
		return nil, err
	}

	dbConfig := rb.buildDatabaseConfig()

	renderedYaml, err := dbRenderer.Render(fetchedDb, &databases.RenderContext{
		Name:       rb.service.Name,
		Namespace:  rb.service.Namespace,
		TeamID:     rb.service.Spec.TeamRef,
		Definition: *fetchedDb,
		Parameters: dbConfig,
	})
	if err != nil {
		logger.Error(err, "Failed to render database definition", "type", fetchedDb.Type, "name", fetchedDb.Name)
		return nil, err
	}

	objects, err := dbRenderer.RenderToObjects(renderedYaml)
	if err != nil {
		logger.Error(err, "Failed to create runtime objects from rendered YAML", "type", fetchedDb.Type, "name", fetchedDb.Name)
		return nil, err
	}

	return rb.processRenderedObjects(objects, logger), nil
}

func (rb *ResourceBuilder) buildDatabaseConfig() map[string]any {
	dbConfig := make(map[string]any)
	if rb.service.Spec.Config.Database.Config != nil {
		dbConfig = rb.service.Spec.Config.Database.Config.AsMap()
	}

	storage := dbConfig["storage"]
	if storage == "" {
		storage = "1Gi"
	}
	delete(dbConfig, "storage")

	rb.applyDbLabels(dbConfig)
	rb.applyDbEnvironment(dbConfig)
	rb.applyDbCommonConfig(dbConfig, storage)
	rb.applyDbTypeConfig(dbConfig)
	rb.applyDbS3Config(dbConfig)

	return dbConfig
}

func (rb *ResourceBuilder) applyDbLabels(dbConfig map[string]any) {
	labelsMap := ensureMapKey(dbConfig, "labels")
	for k, v := range rb.getCommonLabels() {
		labelsMap[k] = v
	}
}

func (rb *ResourceBuilder) applyDbEnvironment(dbConfig map[string]any) {
	envMap := ensureMapKey(dbConfig, "environment")
	for _, v := range rb.service.Spec.EnvVars {
		envMap[v.Name] = v.Value
	}
}

func (rb *ResourceBuilder) applyDbCommonConfig(dbConfig map[string]any, storage any) {
	commonMap := ensureMapKey(dbConfig, "common")
	commonMap["namespace"] = rb.service.Namespace
	commonMap["storage"] = storage

	replicaCount := int32(1)
	if rb.service.Spec.Config.Replicas != nil {
		replicaCount = *rb.service.Spec.Config.Replicas
	}
	commonMap["replicas"] = replicaCount

	if res := rb.service.Spec.Config.Resources; res != nil {
		resourcesMap := map[string]any{
			"requests": make(map[string]string),
			"limits":   make(map[string]string),
		}
		requests := resourcesMap["requests"].(map[string]string)
		limits := resourcesMap["limits"].(map[string]string)

		if res.CPURequestsMillicores > 0 {
			requests["cpu"] = fmt.Sprintf("%dm", res.CPURequestsMillicores)
		}
		if res.CPULimitsMillicores > 0 {
			limits["cpu"] = fmt.Sprintf("%dm", res.CPULimitsMillicores)
		}
		if res.MemoryRequestsMegabytes > 0 {
			requests["memory"] = fmt.Sprintf("%dMi", res.MemoryRequestsMegabytes)
		}
		if res.MemoryLimitsMegabytes > 0 {
			limits["memory"] = fmt.Sprintf("%dMi", res.MemoryLimitsMegabytes)
		}
		commonMap["resources"] = resourcesMap
	}
}

func (rb *ResourceBuilder) applyDbTypeConfig(dbConfig map[string]any) {
	dbType := strings.ToLower(rb.service.Spec.Config.Database.Type)

	if rb.service.Spec.KubernetesSecret != "" && dbType == "redis" {
		dbConfig["secretName"] = rb.service.Spec.KubernetesSecret
		dbConfig["secretKey"] = "DATABASE_PASSWORD"
	}

	if dbType == "mongodb" {
		dbConfig["existingSecretName"] = fmt.Sprintf("%s-mongo-secret", rb.service.Spec.ServiceRef)
	}

	if dbType == "clickhouse" {
		clusterName := fmt.Sprintf("chi-%s", rb.service.Spec.ServiceRef)
		if len(clusterName) > 15 {
			clusterName = clusterName[:15]
		}
		dbConfig["clusterName"] = clusterName
		dbConfig["existingSecretName"] = fmt.Sprintf("%s-clickhouse-secret", rb.service.Spec.ServiceRef)
	}
}

func (rb *ResourceBuilder) applyDbS3Config(dbConfig map[string]any) {
	s3Map := make(map[string]any)
	dbConfig["s3"] = s3Map

	if cfg := rb.service.Spec.Config.Database.S3BackupConfig; cfg != nil {
		s3Map["enabled"] = true
		s3Map["bucket"] = cfg.Bucket
		s3Map["region"] = cfg.Region
		s3Map["endpoint"] = cfg.Endpoint
		s3Map["secretName"] = cfg.SecretName
		s3Map["backupPrefix"] = rb.service.Spec.ServiceRef
		s3Map["backupSchedule"] = cfg.BackupSchedule
		s3Map["backupRetention"] = cfg.BackupRetentionCount
	}
}

func ensureMapKey(m map[string]any, key string) map[string]any {
	if existing, ok := m[key].(map[string]any); ok {
		return existing
	}
	if existing, ok := m[key].(map[string]string); ok {
		converted := make(map[string]any, len(existing))
		for k, v := range existing {
			converted[k] = v
		}
		m[key] = converted
		return converted
	}
	newMap := make(map[string]any)
	m[key] = newMap
	return newMap
}

func (rb *ResourceBuilder) processRenderedObjects(objects []runtime.Object, logger logr.Logger) []runtime.Object {
	result := make([]runtime.Object, 0, len(objects))
	for _, obj := range objects {
		logger.Info("Processing rendered object", "kind", fmt.Sprintf("%T", obj))
		result = append(result, obj)
	}
	return result
}
