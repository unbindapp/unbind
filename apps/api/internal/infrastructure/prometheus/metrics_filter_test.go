package prometheus

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
)

type MetricsFilterTestSuite struct {
	suite.Suite
}

func (s *MetricsFilterTestSuite) TestMetricsFilterSumBy_Label() {
	testCases := []struct {
		name     string
		sumBy    MetricsFilterSumBy
		expected string
	}{
		{
			name:     "Project sum by",
			sumBy:    MetricsFilterSumByProject,
			expected: "label_unbind_project",
		},
		{
			name:     "Environment sum by",
			sumBy:    MetricsFilterSumByEnvironment,
			expected: "label_unbind_environment",
		},
		{
			name:     "Service sum by",
			sumBy:    MetricsFilterSumByService,
			expected: "label_unbind_service",
		},
		{
			name:     "Invalid sum by defaults to service",
			sumBy:    MetricsFilterSumBy("invalid"),
			expected: "label_unbind_service",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			result := tc.sumBy.Label()
			s.Equal(tc.expected, result)
		})
	}
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_NilFilter() {
	result := buildLabelSelector(nil)
	s.Equal("", result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_EmptyFilter() {
	filter := &MetricsFilter{}
	result := buildLabelSelector(filter)
	s.Equal("", result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_TeamOnly() {
	teamID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	filter := &MetricsFilter{
		TeamID: teamID,
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_team="11111111-1111-1111-1111-111111111111"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_ProjectOnly() {
	projectID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	filter := &MetricsFilter{
		ProjectID: projectID,
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_project="22222222-2222-2222-2222-222222222222"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_EnvironmentOnly() {
	environmentID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	filter := &MetricsFilter{
		EnvironmentID: environmentID,
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_environment="33333333-3333-3333-3333-333333333333"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_SingleServiceOnly() {
	serviceID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	filter := &MetricsFilter{
		ServiceIDs: []uuid.UUID{serviceID},
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_service="44444444-4444-4444-4444-444444444444"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_TeamAndProject() {
	teamID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	projectID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	filter := &MetricsFilter{
		TeamID:    teamID,
		ProjectID: projectID,
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_team="11111111-1111-1111-1111-111111111111", label_unbind_project="22222222-2222-2222-2222-222222222222"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_EnvironmentWithSingleService() {
	environmentID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	serviceID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	filter := &MetricsFilter{
		EnvironmentID: environmentID,
		ServiceIDs:    []uuid.UUID{serviceID},
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_environment="33333333-3333-3333-3333-333333333333", label_unbind_service=~"44444444-4444-4444-4444-444444444444"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_EnvironmentWithMultipleServices() {
	environmentID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	serviceID1 := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	serviceID2 := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	serviceID3 := uuid.MustParse("66666666-6666-6666-6666-666666666666")
	filter := &MetricsFilter{
		EnvironmentID: environmentID,
		ServiceIDs:    []uuid.UUID{serviceID1, serviceID2, serviceID3},
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_environment="33333333-3333-3333-3333-333333333333", label_unbind_service=~"44444444-4444-4444-4444-444444444444|55555555-5555-5555-5555-555555555555|66666666-6666-6666-6666-666666666666"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_FullFilter() {
	teamID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	projectID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	environmentID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	serviceID1 := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	serviceID2 := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	filter := &MetricsFilter{
		TeamID:        teamID,
		ProjectID:     projectID,
		EnvironmentID: environmentID,
		ServiceIDs:    []uuid.UUID{serviceID1, serviceID2},
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_team="11111111-1111-1111-1111-111111111111", label_unbind_project="22222222-2222-2222-2222-222222222222", label_unbind_environment="33333333-3333-3333-3333-333333333333", label_unbind_service=~"44444444-4444-4444-4444-444444444444|55555555-5555-5555-5555-555555555555"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_NoEnvironmentMultipleServices() {
	// When there's no environment but multiple services, only use the first service
	teamID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	serviceID1 := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	serviceID2 := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	filter := &MetricsFilter{
		TeamID:     teamID,
		ServiceIDs: []uuid.UUID{serviceID1, serviceID2},
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_team="11111111-1111-1111-1111-111111111111", label_unbind_service="44444444-4444-4444-4444-444444444444"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_NilUUIDs() {
	// Test with nil UUIDs (zero values)
	filter := &MetricsFilter{
		TeamID:        uuid.Nil,
		ProjectID:     uuid.Nil,
		EnvironmentID: uuid.Nil,
		ServiceIDs:    []uuid.UUID{},
	}

	result := buildLabelSelector(filter)
	s.Equal("", result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_MixedNilAndValidUUIDs() {
	// Test with some nil and some valid UUIDs
	projectID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	serviceID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	filter := &MetricsFilter{
		TeamID:        uuid.Nil, // Should be ignored
		ProjectID:     projectID,
		EnvironmentID: uuid.Nil, // Should be ignored
		ServiceIDs:    []uuid.UUID{serviceID},
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_project="22222222-2222-2222-2222-222222222222", label_unbind_service="44444444-4444-4444-4444-444444444444"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_EmptyServiceIDs() {
	environmentID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	filter := &MetricsFilter{
		EnvironmentID: environmentID,
		ServiceIDs:    []uuid.UUID{}, // Empty slice
	}

	result := buildLabelSelector(filter)
	expected := `{label_unbind_environment="33333333-3333-3333-3333-333333333333"}`
	s.Equal(expected, result)
}

func (s *MetricsFilterTestSuite) TestBuildLabelSelector_OrderConsistency() {
	// Test that the order of labels in the selector is consistent
	teamID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	projectID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	environmentID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	serviceID := uuid.MustParse("44444444-4444-4444-4444-444444444444")

	filter := &MetricsFilter{
		TeamID:        teamID,
		ProjectID:     projectID,
		EnvironmentID: environmentID,
		ServiceIDs:    []uuid.UUID{serviceID},
	}

	// Run multiple times to ensure consistent order
	for i := 0; i < 5; i++ {
		result := buildLabelSelector(filter)
		expected := `{label_unbind_team="11111111-1111-1111-1111-111111111111", label_unbind_project="22222222-2222-2222-2222-222222222222", label_unbind_environment="33333333-3333-3333-3333-333333333333", label_unbind_service=~"44444444-4444-4444-4444-444444444444"}`
		s.Equal(expected, result, "Iteration %d should produce consistent output", i)
	}
}

func (s *MetricsFilterTestSuite) TestMetricsFilterConstants() {
	// Test that the constants are defined correctly
	s.Equal(MetricsFilterSumBy("project"), MetricsFilterSumByProject)
	s.Equal(MetricsFilterSumBy("environment"), MetricsFilterSumByEnvironment)
	s.Equal(MetricsFilterSumBy("service"), MetricsFilterSumByService)
}

func TestMetricsFilterTestSuite(t *testing.T) {
	suite.Run(t, new(MetricsFilterTestSuite))
}
