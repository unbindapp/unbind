package prometheus

import (
	"testing"

	"github.com/stretchr/testify/suite"
)

type NodeMetricsFilterTestSuite struct {
	suite.Suite
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeInstanceSelector_NoInstances() {
	s.Equal("", buildNodeInstanceSelector(nil))
	s.Equal("", buildNodeInstanceSelector(&NodeMetricsFilter{}))
	s.Equal("", buildNodeInstanceSelector(&NodeMetricsFilter{InstanceIPs: []string{}}))
	s.Equal("", buildNodeInstanceSelector(&NodeMetricsFilter{InstanceIPs: nil}))
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeInstanceSelector_MatchesAnyPort() {
	result := buildNodeInstanceSelector(&NodeMetricsFilter{InstanceIPs: []string{"10.0.0.1"}})
	s.Equal(`instance=~"10\\.0\\.0\\.1:\\d+"`, result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeInstanceSelector_MultipleInstances() {
	result := buildNodeInstanceSelector(&NodeMetricsFilter{
		InstanceIPs: []string{"10.0.0.1", "192.168.1.10"},
	})
	s.Equal(`instance=~"10\\.0\\.0\\.1:\\d+|192\\.168\\.1\\.10:\\d+"`, result)
}

func (s *NodeMetricsFilterTestSuite) TestBuildNodeInstanceSelector_IPv6() {
	result := buildNodeInstanceSelector(&NodeMetricsFilter{InstanceIPs: []string{"fd00::1"}})
	s.Equal(`instance=~"\\[fd00::1\\]:\\d+"`, result)
}

func (s *NodeMetricsFilterTestSuite) TestJoinSelectors() {
	s.Equal("", joinSelectors())
	s.Equal("", joinSelectors("", ""))
	s.Equal(`mode!="idle"`, joinSelectors(`mode!="idle"`, ""))
	s.Equal(`mode!="idle", instance=~"x"`, joinSelectors(`mode!="idle"`, `instance=~"x"`))
}

func TestNodeMetricsFilterTestSuite(t *testing.T) {
	suite.Run(t, new(NodeMetricsFilterTestSuite))
}
