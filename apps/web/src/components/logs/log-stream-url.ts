import type { TLogsListInput } from "@/lib/queries/logs";

/**
 * What the stream tails and where it resumes are separate concerns: the resume
 * position moves with every batch, so it is applied here at connect time rather
 * than baked into a URL whose changes would restart the connection.
 */
export function buildLogStreamUrl(
  apiUrl: string,
  input: TLogsListInput,
  resume: string | null,
): string {
  const params = new URLSearchParams({
    type: input.type,
    team_id: input.teamId,
    project_id: input.projectId ?? "",
    environment_id: input.environmentId ?? "",
  });
  if (input.type === "service" || input.type === "deployment") {
    params.set("service_id", input.serviceId ?? "");
  }
  if (input.type === "deployment" || input.type === "build") {
    params.set("deployment_id", input.deploymentId ?? "");
  }
  if (input.search) params.set("search", input.search);
  if (input.levels) params.set("levels", input.levels);
  if (input.serviceIds) params.set("service_ids", input.serviceIds);
  // overlapping what is already buffered is free, it gets deduped by key, so
  // resume from the newest line we hold rather than risk skipping past one
  params.set("start", resume ?? input.start ?? "");
  return `${apiUrl}/logs/stream?${params.toString()}`;
}
