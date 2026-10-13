import { TServiceShallow } from "@/lib/queries/services";

// An empty schedule runs the service continuously
export const continuousScheduleValue = "";
export const customCronScheduleValue = "custom";

export const cronSchedulePresets = [
  { value: "*/5 * * * *", label: "Every 5 minutes" },
  { value: "*/10 * * * *", label: "Every 10 minutes" },
  { value: "*/30 * * * *", label: "Every 30 minutes" },
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 0 * * *", label: "Daily" },
  { value: "0 0 * * 0", label: "Weekly" },
];

export function cronScheduleToPreset(cron: string) {
  if (cron === continuousScheduleValue) return continuousScheduleValue;
  const preset = cronSchedulePresets.find((p) => p.value === cron);
  return preset ? preset.value : customCronScheduleValue;
}

export function formatCronSchedule(cron: string) {
  if (cron === continuousScheduleValue) return "Off";
  const preset = cronSchedulePresets.find((p) => p.value === cron);
  return preset ? preset.label : `Custom (${cron})`;
}

export function formatCronTimezone(timezone: string) {
  return timezone === "" ? "UTC" : timezone;
}

export function isScheduledService(service: TServiceShallow) {
  return Boolean(service.config.cron_schedule);
}
