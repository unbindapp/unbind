export const customScheduleValue = "custom";

export const backupSchedulePresets = [
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 */12 * * *", label: "Every 12 hours" },
  { value: "0 0 * * *", label: "Daily" },
  { value: "0 0 * * 0", label: "Weekly" },
];

export function scheduleToPreset(cron: string) {
  const preset = backupSchedulePresets.find((p) => p.value === cron);
  return preset ? preset.value : customScheduleValue;
}

export function formatBackupSchedule(cron: string) {
  const preset = backupSchedulePresets.find((p) => p.value === cron);
  return preset ? preset.label : `Custom (${cron})`;
}

const cronFields = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day", min: 1, max: 31 },
  { name: "month", min: 1, max: 12 },
  { name: "weekday", min: 0, max: 6 },
];

const cronFieldPattern =
  /^(\*|[0-9]{1,2}(-[0-9]{1,2})?(,[0-9]{1,2}(-[0-9]{1,2})?)*|\*\/[0-9]{1,2})$/;

// Mirrors ValidateCronExpression in apps/api/internal/common/utils/cron.go
export function validateCronExpression(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5) {
    return { message: "Must have 5 fields: minute hour day month weekday." };
  }

  for (const [i, part] of parts.entries()) {
    const field = cronFields[i];
    if (!cronFieldPattern.test(part)) {
      return { message: `Invalid ${field.name} field: ${part}` };
    }
    if (part === "*") continue;

    if (part.startsWith("*/")) {
      const step = Number(part.slice(2));
      if (step <= 0) return { message: `Invalid step value in ${field.name} field: ${part}` };
      continue;
    }

    for (const value of part.split(",")) {
      const [start, end] = value.split("-").map(Number);
      const last = end ?? start;
      if (start < field.min || last > field.max || start > last) {
        return {
          message: `Invalid ${field.name} value: ${value} (must be between ${field.min} and ${field.max}).`,
        };
      }
    }
  }

  return undefined;
}

export function validatePositiveInteger(value: string) {
  if (value === undefined || value === "") {
    return undefined;
  }
  const num = Number(value);
  if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    return {
      message: "Must be a positive integer.",
    };
  }
  return undefined;
}

export function validateBackupRetentionCount(value: string) {
  if (value === undefined || value.trim() === "") {
    return { message: "Retention is required." };
  }
  return validatePositiveInteger(value);
}
