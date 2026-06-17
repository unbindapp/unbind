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

// NodeMetricsFilter contains filtering options for node metrics
type NodeMetricsFilter struct {
	NodeName []string
}
