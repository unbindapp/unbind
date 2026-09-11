package templates

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestResourceRecommendationsCoverRequests(t *testing.T) {
	for _, tpl := range NewTemplater(nil).AvailableTemplates() {
		t.Run(tpl.Name, func(t *testing.T) {
			rec := tpl.ResourceRecommendations
			assert.Greater(t, rec.MinimumRecommendedCPU, 0.0)
			assert.Greater(t, rec.MinimumRecommendedRAMGB, 0.0)

			var cpuMillicores, memoryMegabytes int64
			for _, svc := range tpl.Services {
				res := svc.Resources
				if res == nil && svc.Type == schema.ServiceTypeDatabase {
					res = schema.DefaultDatabaseResources()
				}
				spec := schema.ResolveResources(res)
				cpuMillicores += spec.CPURequestsMillicores
				memoryMegabytes += spec.MemoryRequestsMegabytes
			}
			assert.GreaterOrEqual(t, rec.MinimumRecommendedCPU, float64(cpuMillicores)/1000, "cpu suggestion below the sum of requests")
			assert.GreaterOrEqual(t, rec.MinimumRecommendedRAMGB, float64(memoryMegabytes)/1024, "memory suggestion below the sum of requests")
		})
	}
}
