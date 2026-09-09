import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dropSettledChanges,
  serviceChangesMatchingServer,
  variableChangesMatchingServer,
} from "./reconcile.ts";
import type { TStagedChangesState, TStagedServiceChange, TStagedVariableChange } from "./types.ts";

const ids = { teamId: "team", projectId: "project", environmentId: "env" };

function variable(name: string, value: string | null, previous: string | null = "old") {
  const change: TStagedVariableChange = {
    id: `variable:service:${name}`,
    scope: { type: "service", ...ids, serviceId: "api" },
    scopeName: "api",
    name,
    value,
    previous,
    createdAt: 1,
  };
  return change;
}

function service(field: TStagedServiceChange["field"], value: string | number) {
  const change: TStagedServiceChange = {
    id: `service:api:${field}`,
    ...ids,
    serviceId: "api",
    serviceName: "api",
    field,
    value,
    label: field,
    displayValue: String(value),
    displayPrevious: "old",
    createdAt: 1,
  };
  return change;
}

function state(
  variables: TStagedVariableChange[] = [],
  services: TStagedServiceChange[] = [],
): TStagedChangesState {
  return {
    variables: Object.fromEntries(variables.map((v) => [v.id, v])),
    services: Object.fromEntries(services.map((s) => [s.id, s])),
  };
}

test("dropSettledChanges removes settled changes that still hold the deployed value", () => {
  const a = variable("A", "1");
  const b = variable("B", "2");
  const replicas = service("instanceCount", 3);
  const current = state([a, b], [replicas]);
  const applying = { [a.id]: "1", [b.id]: "2", [replicas.id]: 3 };

  const result = dropSettledChanges(current, applying, new Set([a.id, replicas.id]));

  assert.deepEqual(Object.keys(result.variables), [b.id]);
  assert.deepEqual(Object.keys(result.services), []);
});

test("dropSettledChanges keeps a change re-staged with another value during the deploy", () => {
  const a = variable("A", "edited-meanwhile");
  const applying = { [a.id]: "1" };

  const result = dropSettledChanges(state([a]), applying, new Set([a.id]));

  assert.deepEqual(Object.keys(result.variables), [a.id]);
});

test("dropSettledChanges keeps changes staged after the deploy started", () => {
  const a = variable("A", "1");
  const late = variable("LATE", "x");

  const result = dropSettledChanges(state([a, late]), { [a.id]: "1" }, new Set([a.id, late.id]));

  assert.deepEqual(Object.keys(result.variables), [late.id]);
});

test("variableChangesMatchingServer reports upserts the server already holds", () => {
  const same = variable("SAME", "1");
  const different = variable("DIFFERENT", "2");
  const fresh = variable("NEW", "3", null);
  const server = new Map([
    ["SAME", "1"],
    ["DIFFERENT", "other"],
    ["NEW", "3"],
  ]);

  const result = variableChangesMatchingServer([same, different, fresh], server);

  assert.deepEqual(result, [same.id, fresh.id]);
});

test("variableChangesMatchingServer reports deletes of variables the server no longer has", () => {
  const gone = variable("GONE", null);
  const stillThere = variable("THERE", null);
  const server = new Map([["THERE", "1"]]);

  const result = variableChangesMatchingServer([gone, stillThere], server);

  assert.deepEqual(result, [gone.id]);
});

test("serviceChangesMatchingServer reports fields equal to the server value", () => {
  const replicas = service("instanceCount", 3);
  const cpu = service("cpuLimitMillicores", 500);
  const branch = service("gitBranch", "main");

  const result = serviceChangesMatchingServer(
    { instanceCount: replicas, cpuLimitMillicores: cpu, gitBranch: branch },
    { instanceCount: 3, cpuLimitMillicores: 250 },
  );

  assert.deepEqual(result, [replicas.id]);
});
