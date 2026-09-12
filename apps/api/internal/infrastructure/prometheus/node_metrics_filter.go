package prometheus

import "github.com/prometheus/common/model"

type NodeMetrics struct {
	CPU        []model.SamplePair
	RAM        []model.SamplePair
	Network    []model.SamplePair
	Disk       []model.SamplePair
	FileSystem []model.SamplePair
	Load       []model.SamplePair
}

// NodeMetricsFilter narrows node metrics to specific servers. node-exporter labels its
// series with the scrape target (<internal IP>:<port>), so servers are selected by IP.
type NodeMetricsFilter struct {
	InstanceIPs []string
}
