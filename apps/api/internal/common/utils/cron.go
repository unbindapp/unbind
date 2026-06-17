package utils

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// ValidateCronExpression validates a cron expression string.
// It checks if the expression follows the standard cron format: minute hour day month weekday
// Returns an error if the expression is invalid, nil if valid.
func ValidateCronExpression(cron string) error {
	// Split the cron expression into its components
	parts := strings.Fields(cron)
	if len(parts) != 5 {
		return fmt.Errorf("invalid cron expression: must have exactly 5 fields (minute hour day month weekday), got %d", len(parts))
	}

	// Define valid ranges for each field
	ranges := []struct {
		min, max int
		name     string
	}{
		{0, 59, "minute"},
		{0, 23, "hour"},
		{1, 31, "day"},
		{1, 12, "month"},
		{0, 6, "weekday"},
	}

	// Regular expression for valid cron field characters
	validChars := regexp.MustCompile(`^(\*|[0-9]{1,2}(-[0-9]{1,2})?(,[0-9]{1,2}(-[0-9]{1,2})?)*|\*/[0-9]{1,2})$`)

	for i, part := range parts {
		if !validChars.MatchString(part) {
			return fmt.Errorf("invalid %s field: %s", ranges[i].name, part)
		}

		// Skip validation for wildcard
		if part == "*" {
			continue
		}

		// Handle step values (e.g., */5)
		if strings.HasPrefix(part, "*/") {
			step, err := strconv.Atoi(part[2:])
			if err != nil || step <= 0 {
				return fmt.Errorf("invalid step value in %s field: %s", ranges[i].name, part)
			}
			continue
		}

		// Handle ranges and lists
		values := strings.Split(part, ",")
		for _, value := range values {
			if strings.Contains(value, "-") {
				// Handle range (e.g., 1-5)
				rangeParts := strings.Split(value, "-")
				if len(rangeParts) != 2 {
					return fmt.Errorf("invalid range in %s field: %s", ranges[i].name, value)
				}

				start, err := strconv.Atoi(rangeParts[0])
				if err != nil {
					return fmt.Errorf("invalid start value in %s range: %s", ranges[i].name, rangeParts[0])
				}

				end, err := strconv.Atoi(rangeParts[1])
				if err != nil {
					return fmt.Errorf("invalid end value in %s range: %s", ranges[i].name, rangeParts[1])
				}

				if start < ranges[i].min || end > ranges[i].max || start > end {
					return fmt.Errorf("invalid range in %s field: %d-%d (must be between %d and %d)",
						ranges[i].name, start, end, ranges[i].min, ranges[i].max)
				}
			} else {
				// Handle single value
				num, err := strconv.Atoi(value)
				if err != nil {
					return fmt.Errorf("invalid value in %s field: %s", ranges[i].name, value)
				}

				if num < ranges[i].min || num > ranges[i].max {
					return fmt.Errorf("invalid value in %s field: %d (must be between %d and %d)",
						ranges[i].name, num, ranges[i].min, ranges[i].max)
				}
			}
		}
	}

	return nil
}
