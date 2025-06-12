import { TServiceShallow } from "@/server/trpc/api/services/types";

export function getNetworkingEntityId(service: TServiceShallow): string {
  return `networking-${service.id}`;
}

export function getDomainPortEntityId(domain: string, port?: number) {
  return `domain-port-${domain}:${port}`;
}

export function getNetworkingDisplayUrl({ host, port }: { host: string; port: string }) {
  return `${host}${port ? `:${port}` : ""}`;
}
