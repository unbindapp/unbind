import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApplyChangesPayload, idsToKeepAfterFailures } from "./payload.ts";
import type { TChangesState, TStagedServiceChange, TStagedVariableChange } from "./types.ts";

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
  value: string | number,
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

function state(
  variables: TStagedVariableChange[] = [],
  services: TStagedServiceChange[] = [],
): TChangesState {
  return {
    variables: Object.fromEntries(variables.map((v) => [v.id, v])),
    services: Object.fromEntries(services.map((s) => [s.id, s])),
  };
}

test("groups variable changes by scope with upserts and deletes", () => {
  const payload = buildApplyChangesPayload(
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
  const payload = buildApplyChangesPayload(
    state(
      [],
      [
        service("instanceCount", 3),
        service("cpuLimitMillicores", -1),
        service("healthCheckType", "http"),
        service("healthCheckEndpoint", "/health"),
        service("gitBranch", "develop", { serviceId: "web" }),
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
  assert.equal(web.replicas, undefined);
});

test("keeps only the changes that failed to apply", () => {
  const current = state(
    [
      variable("A", "1"),
      variable("T", "2", { scope: { type: "team", teamId: "team" } }),
      variable("P", "3", { scope: { type: "project", teamId: "team", projectId: "project" } }),
    ],
    [service("instanceCount", 3), service("gitBranch", "develop", { serviceId: "web" })],
  );

  const keep = idsToKeepAfterFailures(current, [
    { service_id: "web", message: "boom" },
    { variables: { type: "team", team_id: "team" }, message: "boom" },
  ]);

  assert.deepEqual([...keep].sort(), ["service:web:gitBranch", "variable:team::T"]);
  assert.equal(idsToKeepAfterFailures(current, []).size, 0);
});
