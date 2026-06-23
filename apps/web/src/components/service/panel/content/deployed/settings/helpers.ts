import { TServiceShallow } from "@/lib/queries/services";

export function shouldServiceSettingsHaveDeploySection(service: TServiceShallow) {
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
