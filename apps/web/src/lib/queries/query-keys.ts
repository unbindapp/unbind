/**
 * Central query-key factory. Keys are hierarchical so a prefix invalidates a
 * whole subtree, e.g. `invalidateQueries({ queryKey: ["projects"] })`.
 */
export const queryKeys = {
  me: ["me"] as const,
  teams: {
    list: () => ["teams", "list"] as const,
    detail: (teamId: string) => ["teams", "detail", teamId] as const,
  },
  projects: {
    list: (teamId: string) => ["projects", "list", teamId] as const,
    detail: (teamId: string, projectId: string) =>
      ["projects", "detail", teamId, projectId] as const,
  },
  environments: {
    list: (teamId: string, projectId: string) =>
      ["environments", "list", teamId, projectId] as const,
    detail: (teamId: string, projectId: string, environmentId: string) =>
      ["environments", "detail", teamId, projectId, environmentId] as const,
  },
  services: {
    list: (teamId: string, projectId: string, environmentId: string) =>
      ["services", "list", teamId, projectId, environmentId] as const,
    detail: (teamId: string, projectId: string, environmentId: string, serviceId: string) =>
      ["services", "detail", teamId, projectId, environmentId, serviceId] as const,
    endpoints: (teamId: string, projectId: string, environmentId: string, serviceId: string) =>
      ["services", "endpoints", teamId, projectId, environmentId, serviceId] as const,
    databases: () => ["services", "databases"] as const,
    database: (type: string, version?: string) =>
      ["services", "database", type, version ?? null] as const,
  },
  deployments: {
    list: (teamId: string, projectId: string, environmentId: string, serviceId: string) =>
      ["deployments", "list", teamId, projectId, environmentId, serviceId] as const,
    detail: (
      teamId: string,
      projectId: string,
      environmentId: string,
      serviceId: string,
      deploymentId: string,
    ) => ["deployments", "detail", teamId, projectId, environmentId, serviceId, deploymentId] as const,
  },
  instances: {
    list: (teamId: string, projectId: string, environmentId: string, serviceId: string) =>
      ["instances", "list", teamId, projectId, environmentId, serviceId] as const,
    health: (teamId: string, projectId: string, environmentId: string, serviceId: string) =>
      ["instances", "health", teamId, projectId, environmentId, serviceId] as const,
  },
  metrics: {
    list: (input: {
      type: string;
      teamId: string;
      projectId?: string;
      environmentId?: string;
      serviceId?: string;
      interval: string;
    }) =>
      [
        "metrics",
        "list",
        input.type,
        input.teamId,
        input.projectId ?? null,
        input.environmentId ?? null,
        input.serviceId ?? null,
        input.interval,
      ] as const,
  },
  system: {
    get: () => ["system", "get"] as const,
    dnsCheck: (domain: string) => ["system", "dns", domain] as const,
    updateCheck: () => ["system", "update", "check"] as const,
    updateStatus: () => ["system", "update", "status"] as const,
  },
  templates: {
    list: () => ["templates", "list"] as const,
    detail: (id: string) => ["templates", "detail", id] as const,
  },
  logs: {
    list: (input: {
      type: string;
      teamId: string;
      projectId?: string;
      environmentId?: string;
      serviceId?: string;
      deploymentId?: string;
      filters?: string;
      since?: string;
      start?: string;
      end?: string;
      limit?: number;
    }) =>
      [
        "logs",
        "list",
        input.type,
        input.teamId,
        input.projectId ?? null,
        input.environmentId ?? null,
        input.serviceId ?? null,
        input.deploymentId ?? null,
        input.filters ?? null,
        input.since ?? null,
        input.start ?? null,
        input.end ?? null,
        input.limit ?? 500,
      ] as const,
  },
  git: {
    repositories: () => ["git", "repositories"] as const,
    app: (uuid: string) => ["git", "app", uuid] as const,
    repository: (installationId: number, owner: string, repoName: string) =>
      ["git", "repository", installationId, owner, repoName] as const,
  },
  docker: {
    search: (search?: string) => ["docker", "search", search ?? null] as const,
    tags: (repository: string, search?: string) =>
      ["docker", "tags", repository, search ?? null] as const,
  },
  storage: {
    s3List: (teamId: string) => ["storage", "s3", "list", teamId] as const,
    s3Detail: (teamId: string, id: string) => ["storage", "s3", "detail", teamId, id] as const,
    volume: (
      teamId: string,
      projectId: string,
      environmentId: string,
      type: string,
      id: string,
    ) => ["storage", "volume", teamId, projectId, environmentId, type, id] as const,
  },
  webhooks: {
    list: (input: { type: "project" | "team"; teamId: string; projectId?: string }) =>
      input.type === "project"
        ? (["webhooks", "list", "project", input.teamId, input.projectId] as const)
        : (["webhooks", "list", "team", input.teamId] as const),
  },
  variables: {
    list: (input: {
      teamId: string;
      projectId?: string;
      environmentId?: string;
      serviceId?: string;
      type: string;
    }) =>
      [
        "variables",
        "list",
        input.teamId,
        input.projectId ?? null,
        input.environmentId ?? null,
        input.serviceId ?? null,
        input.type,
      ] as const,
    available: (teamId: string, projectId: string, environmentId: string, serviceId: string) =>
      ["variables", "available", teamId, projectId, environmentId, serviceId] as const,
  },
};
