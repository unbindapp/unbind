package prometheus

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type MetricsFilterSumBy string

const (
	MetricsFilterSumByProject     MetricsFilterSumBy = "project"
	MetricsFilterSumByEnvironment MetricsFilterSumBy = "environment"
	MetricsFilterSumByService     MetricsFilterSumBy = "service"
)

func (m MetricsFilterSumBy) Label() string {
	switch m {
	case MetricsFilterSumByProject:
		return "label_unbind_project"
	case MetricsFilterSumByEnvironment:
		return "label_unbind_environment"
	case MetricsFilterSumByService:
		return "label_unbind_service"
	default:
		return "label_unbind_service"
	}
}

type MetricsFilter struct {
	TeamID        uuid.UUID
	ProjectID     uuid.UUID
	EnvironmentID uuid.UUID
	// Support numerous service IDs as an OR condition
	ServiceIDs []uuid.UUID
}

// buildLabelSelector constructs the selector for kube_pod_labels
func buildLabelSelector(filter *MetricsFilter) string {
	if filter == nil {
		return ""
	}

	var labelFilters []string
	if filter.TeamID != uuid.Nil {
		labelFilters = append(labelFilters, fmt.Sprintf(`label_unbind_team="%s"`, filter.TeamID.String()))
	}
	if filter.ProjectID != uuid.Nil {
		labelFilters = append(labelFilters, fmt.Sprintf(`label_unbind_project="%s"`, filter.ProjectID.String()))
	}
	if filter.EnvironmentID != uuid.Nil {
		labelFilters = append(labelFilters, fmt.Sprintf(`label_unbind_environment="%s"`, filter.EnvironmentID.String()))

		// If we have an EnvironmentID and at least one ServiceID, include all ServiceIDs in a regex match
		if len(filter.ServiceIDs) > 0 {
			stringServiceIDs := make([]string, len(filter.ServiceIDs))
			for i, serviceID := range filter.ServiceIDs {
				stringServiceIDs[i] = serviceID.String()
			}

			// Join the service IDs with "|" for regex OR in PromQL
			serviceRegex := strings.Join(stringServiceIDs, "|")
			labelFilters = append(labelFilters, fmt.Sprintf(`label_unbind_service=~"%s"`, serviceRegex))

		}
	} else {
		// Assume we're only picking a single service here
		if len(filter.ServiceIDs) > 0 {
			labelFilters = append(labelFilters, fmt.Sprintf(`label_unbind_service="%s"`, filter.ServiceIDs[0].String()))
		}
	}

	if len(labelFilters) == 0 {
		return ""
	}

	// Combine all filters with logical AND (comma in PromQL)
	filterQuery := "{"
	for i, labelFilter := range labelFilters {
		if i > 0 {
			filterQuery += ", "
		}
		filterQuery += labelFilter
	}
	filterQuery += "}"

	return filterQuery
}
