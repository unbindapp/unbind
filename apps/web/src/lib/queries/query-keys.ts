/**
 * Central query-key factory. Keys are hierarchical so a prefix invalidates a
 * whole subtree, e.g. `invalidateQueries({ queryKey: ["projects"] })`.
 */
export const queryKeys = {
  me: ["me"] as const,
  teams: {
    list: () => ["teams", "list"] as const,
    detail: (input: { teamId: string }) => ["teams", "detail", input.teamId] as const,
  },
  projects: {
    list: (input: { teamId: string }) => ["projects", "list", input.teamId] as const,
    detail: (input: { teamId: string; projectId: string }) =>
      ["projects", "detail", input.teamId, input.projectId] as const,
  },
  environments: {
    list: (input: { teamId: string; projectId: string }) =>
      ["environments", "list", input.teamId, input.projectId] as const,
    detail: (input: { teamId: string; projectId: string; environmentId: string }) =>
      ["environments", "detail", input.teamId, input.projectId, input.environmentId] as const,
  },
  services: {
    list: (input: { teamId: string; projectId: string; environmentId: string }) =>
      ["services", "list", input.teamId, input.projectId, input.environmentId] as const,
    detail: (input: {
      teamId: string;
      projectId: string;
      environmentId: string;
      serviceId: string;
    }) =>
      ["services", "detail", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
    endpoints: (input: {
      teamId: string;
      projectId: string;
      environmentId: string;
      serviceId: string;
    }) =>
      ["services", "endpoints", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
    databases: () => ["services", "databases"] as const,
    database: (input: { type: string; version?: string }) =>
      ["services", "database", input.type, input.version ?? null] as const,
  },
  deployments: {
    list: (input: {
      teamId: string;
      projectId: string;
      environmentId: string;
      serviceId: string;
    }) =>
      ["deployments", "list", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
    detail: (input: {
      teamId: string;
      projectId: string;
      environmentId: string;
      serviceId: string;
      deploymentId: string;
    }) =>
      [
        "deployments",
        "detail",
        input.teamId,
        input.projectId,
        input.environmentId,
        input.serviceId,
        input.deploymentId,
      ] as const,
  },
  instances: {
    list: (input: {
      teamId: string;
      projectId: string;
      environmentId: string;
      serviceId: string;
    }) =>
      ["instances", "list", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
    health: (input: {
      teamId: string;
      projectId: string;
      environmentId: string;
      serviceId: string;
    }) =>
      ["instances", "health", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
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
    dnsCheck: (input: { domain: string }) => ["system", "dns", input.domain] as const,
    updateCheck: () => ["system", "update", "check"] as const,
    updateStatus: () => ["system", "update", "status"] as const,
  },
  templates: {
    list: () => ["templates", "list"] as const,
    detail: (input: { id: string }) => ["templates", "detail", input.id] as const,
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
    app: (input: { uuid: string }) => ["git", "app", input.uuid] as const,
    repository: (input: { installationId: number; owner: string; repoName: string }) =>
      ["git", "repository", input.installationId, input.owner, input.repoName] as const,
  },
  docker: {
    search: (input: { search?: string }) => ["docker", "search", input.search ?? null] as const,
    tags: (input: { repository: string; search?: string }) =>
      ["docker", "tags", input.repository, input.search ?? null] as const,
  },
  storage: {
    s3List: (input: { teamId: string }) => ["storage", "s3", "list", input.teamId] as const,
    s3Detail: (input: { teamId: string; id: string }) =>
      ["storage", "s3", "detail", input.teamId, input.id] as const,
    volume: (input: {
      teamId: string;
      projectId: string;
      environmentId: string;
      type: string;
      id: string;
    }) =>
      ["storage", "volume", input.teamId, input.projectId, input.environmentId, input.type, input.id] as const,
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
    available: (input: {
      teamId: string;
      projectId: string;
      environmentId: string;
      serviceId: string;
    }) =>
      ["variables", "available", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
  },
};
