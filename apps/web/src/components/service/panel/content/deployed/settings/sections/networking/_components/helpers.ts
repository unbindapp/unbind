export function getNetworkingEntityId(serviceId: string): string {
  return `networking-${serviceId}`;
}

export function getDomainPortEntityId(domain: string, port?: number) {
  return `domain-port-${domain}:${port}`;
}

export function getNetworkingDisplayUrl({ host, port }: { host: string; port: string }) {
  return `${host}${port ? `:${port}` : ""}`;
}
