import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApplyStagedChangesPayload, idsToKeepAfterFailures } from "./payload.ts";
import {
  listChangeId,
  type TStageListInput,
  type TStagedChangesState,
  type TStagedListChange,
  type TStagedServiceChange,
  type TStagedVariableChange,
} from "./types.ts";

const ids = {
  teamId: "team",
  projectId: "project",
  environmentId: "env",
};

function variable(
  name: string,
  value: string | null,
  overrides: Partial<TStagedVariableChange> = {},
): TStagedVariableChange {
  const scope = overrides.scope ?? { type: "service", ...ids, serviceId: "api" };
  return {
    id: `variable:${scope.type}:${scope.serviceId ?? ""}:${name}`,
    scope,
    scopeName: "api",
    name,
    value,
    previous: "old",
    createdAt: 1,
    ...overrides,
  };
}

function service(
  field: TStagedServiceChange["field"],
  value: TStagedServiceChange["value"],
  overrides: Partial<TStagedServiceChange> = {},
): TStagedServiceChange {
  return {
    id: `service:${overrides.serviceId ?? "api"}:${field}`,
    ...ids,
    serviceId: "api",
    serviceName: "api",
    field,
    value,
    label: field,
    displayValue: String(value),
    displayPrevious: "",
    createdAt: 1,
    ...overrides,
  };
}

type TOwnerKey = "teamId" | "projectId" | "environmentId" | "serviceId" | "serviceName";
type TListFields = TStageListInput extends infer T
  ? T extends unknown
    ? Omit<T, TOwnerKey>
    : never
  : never;

function list(fields: TListFields, serviceId = "api"): TStagedListChange {
  const input: TStageListInput = { ...ids, serviceId, serviceName: serviceId, ...fields };
  return { ...input, id: listChangeId(input), createdAt: 1 };
}

function state(
  variables: TStagedVariableChange[] = [],
  services: TStagedServiceChange[] = [],
  lists: TStagedListChange[] = [],
): TStagedChangesState {
  return {
    variables: Object.fromEntries(variables.map((v) => [v.id, v])),
    services: Object.fromEntries(services.map((s) => [s.id, s])),
    lists: Object.fromEntries(lists.map((l) => [l.id, l])),
  };
}

test("groups variable changes by scope with upserts and deletes", () => {
  const payload = buildApplyStagedChangesPayload(
    state([
      variable("A", "1"),
      variable("B", null),
      variable("C", "3", { scope: { type: "team", teamId: "team" }, createdAt: 0 }),
    ]),
  );

  assert.deepEqual(payload.variables, [
    {
      type: "team",
      team_id: "team",
      project_id: undefined,
      environment_id: undefined,
      service_id: undefined,
      upserts: [{ name: "C", value: "3" }],
      deletes: [],
    },
    {
      type: "service",
      team_id: "team",
      project_id: "project",
      environment_id: "env",
      service_id: "api",
      upserts: [{ name: "A", value: "1" }],
      deletes: ["B"],
    },
  ]);
  assert.deepEqual(payload.services, []);
});

test("merges service field changes into one update per service", () => {
  const payload = buildApplyStagedChangesPayload(
    state(
      [],
      [
        service("replicaCount", 3),
        service("cpuLimitMillicores", -1),
        service("healthCheckType", "http"),
        service("healthCheckEndpoint", "/health"),
        service("gitBranch", "develop", { serviceId: "web" }),
        service("backupSchedule", "0 */6 * * *", { serviceId: "web" }),
        service("backupRetentionCount", 5, { serviceId: "web" }),
      ],
    ),
  );

  assert.equal(payload.services.length, 2);
  const [api, web] = payload.services;
  assert.equal(api.service_id, "api");
  assert.equal(api.replicas, 3);
  assert.deepEqual(api.resources, { cpu_limits_millicores: -1 });
  assert.deepEqual(api.health_check, { type: "http", path: "/health" });
  assert.equal(web.service_id, "web");
  assert.equal(web.git_branch, "develop");
  assert.equal(web.backup_schedule, "0 */6 * * *");
  assert.equal(web.backup_retention_count, 5);
  assert.equal(web.replicas, undefined);
});

test("splits a staged repository into installation, owner and name", () => {
  const payload = buildApplyStagedChangesPayload(
    state([], [service("gitRepository", "42:yekta/bio"), service("gitBranch", "main")]),
  );
  const [web] = payload.services;
  assert.equal(web.github_installation_id, 42);
  assert.equal(web.repository_owner, "yekta");
  assert.equal(web.repository_name, "bio");
  assert.equal(web.git_branch, "main");
});

test("a staged repository without a branch leaves the branch to the server", () => {
  const payload = buildApplyStagedChangesPayload(
    state([], [service("gitRepository", "42:yekta/bio")]),
  );
  const [web] = payload.services;
  assert.equal(web.repository_name, "bio");
  assert.equal(web.git_branch, undefined);
});

test("carries a boolean field through as a boolean", () => {
  const payload = buildApplyStagedChangesPayload(
    state([], [service("isPublic", false), service("isPublic", true, { serviceId: "web" })]),
  );

  assert.equal(payload.services.length, 2);
  const [api, web] = payload.services;
  assert.equal(api.is_public, false);
  assert.equal(web.is_public, true);
});

test("nests database settings into database_config", () => {
  const payload = buildApplyStagedChangesPayload(
    state(
      [],
      [
        service("walLevel", "logical"),
        service("maxReplicationSlots", 20),
        service("maxSlotWalKeepSizeMb", 0),
      ],
    ),
  );

  assert.equal(payload.services.length, 1);
  assert.deepEqual(payload.services[0].database_config, {
    walLevel: "logical",
    maxReplicationSlots: 20,
    maxSlotWalKeepSizeMb: 0,
  });
});

test("keeps only the changes that failed to apply", () => {
  const current = state(
    [
      variable("A", "1"),
      variable("T", "2", { scope: { type: "team", teamId: "team" } }),
      variable("P", "3", { scope: { type: "project", teamId: "team", projectId: "project" } }),
    ],
    [service("replicaCount", 3), service("gitBranch", "develop", { serviceId: "web" })],
  );

  const keep = idsToKeepAfterFailures(current, [
    { service_id: "web", message: "boom" },
    { variables: { type: "team", team_id: "team" }, message: "boom" },
  ]);

  assert.deepEqual([...keep].sort(), ["service:web:gitBranch", "variable:team::T"]);
  assert.equal(idsToKeepAfterFailures(current, []).size, 0);
});

test("splits staged watch paths into a list", () => {
  const payload = buildApplyStagedChangesPayload(
    state([], [service("watchPaths", "apps/api/**\n!apps/api/**/*.md")]),
  );
  assert.deepEqual(payload.services[0].watch_paths, ["apps/api/**", "!apps/api/**/*.md"]);

  const cleared = buildApplyStagedChangesPayload(state([], [service("watchPaths", "")]));
  assert.deepEqual(cleared.services[0].watch_paths, []);
});

test("folds domain, port and volume changes into the update of their service", () => {
  const payload = buildApplyStagedChangesPayload(
    state(
      [],
      [service("replicaCount", 2)],
      [
        list({
          kind: "host",
          previous: null,
          value: { host: "new.example.com", port: 8080 },
          addsPort: true,
        }),
        list({
          kind: "host",
          previous: { host: "old.example.com", port: 3000 },
          value: { host: "renamed.example.com", port: 8080 },
          addsPort: true,
        }),
        list({
          kind: "host",
          previous: { host: "gone.example.com", port: 3000 },
          value: null,
          addsPort: false,
        }),
        list({ kind: "port", port: 9000, op: "add" }),
        list({ kind: "port", port: 3001, op: "remove" }),
        list({ kind: "volume", volumeId: "pvc-1", volumeName: "data", mountPath: "/data" }),
      ],
    ),
  );

  assert.equal(payload.services.length, 1);
  const [update] = payload.services;
  assert.equal(update.replicas, 2);
  assert.deepEqual(update.upsert_hosts, [
    { host: "new.example.com", path: "", target_port: 8080, prev_host: undefined },
    { host: "renamed.example.com", path: "", target_port: 8080, prev_host: "old.example.com" },
  ]);
  assert.deepEqual(update.remove_hosts, [
    { host: "gone.example.com", path: "", target_port: 3000 },
  ]);
  assert.deepEqual(update.add_ports, [{ port: 8080 }, { port: 9000 }]);
  assert.deepEqual(update.remove_ports, [{ port: 3001 }]);
  assert.deepEqual(update.add_volumes, [{ id: "pvc-1", mount_path: "/data" }]);
});

test("a list change alone creates the update of its service", () => {
  const payload = buildApplyStagedChangesPayload(
    state([], [], [list({ kind: "port", port: 9000, op: "add" }, "worker")]),
  );

  assert.deepEqual(
    payload.services.map((s) => [s.service_id, s.add_ports]),
    [["worker", [{ port: 9000 }]]],
  );
});

test("keeps the list changes of a service that failed", () => {
  const failed = list({ kind: "port", port: 9000, op: "add" }, "api");
  const landed = list({ kind: "port", port: 9000, op: "add" }, "worker");

  const keep = idsToKeepAfterFailures(state([], [], [failed, landed]), [
    { service_id: "api", message: "domain already in use" },
  ]);

  assert.deepEqual([...keep], [failed.id]);
});
