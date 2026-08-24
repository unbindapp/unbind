import { TServiceShallow } from "@/lib/queries/services";

export function shouldServiceSettingsHaveDeploySection(service: TServiceShallow) {
  return (
    service.type === "github" || service.type === "docker-image" || service.type === "database"
  );
}

// Databases don't get an instance count: for them replicas changes the cluster
// topology (Postgres numberOfInstances, Redis standalone/replication, etc.).
export function shouldDeploySectionHaveInstances(service: TServiceShallow) {
  return service.type === "github" || service.type === "docker-image";
}

export function shouldServiceSettingsHaveHealthSection(service: TServiceShallow) {
  return service.type === "github" || service.type === "docker-image";
}

export function shouldServiceSettingsHaveBackupsSection(service: TServiceShallow) {
  return service.type === "database";
}

export function shouldServiceSettingsHaveBuildSection(service: TServiceShallow) {
  return service.type === "github";
}
