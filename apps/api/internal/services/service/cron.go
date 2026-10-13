package service_service

import (
	"fmt"
	"time"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// An empty value clears the field, so only set values are checked
func validateCronInput(serviceType schema.ServiceType, schedule, timezone *string) error {
	if schedule == nil && timezone == nil {
		return nil
	}
	if serviceType == schema.ServiceTypeDatabase {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Databases can't run on a schedule")
	}
	if schedule != nil && *schedule != "" {
		if err := utils.ValidateCronExpression(*schedule); err != nil {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Invalid cron schedule: %v", err))
		}
	}
	if timezone != nil && *timezone != "" {
		if _, err := time.LoadLocation(*timezone); err != nil {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Unknown time zone %q", *timezone))
		}
	}
	return nil
}
