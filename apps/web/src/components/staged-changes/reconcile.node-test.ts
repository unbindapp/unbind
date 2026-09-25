import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dropChangesReferencing,
  dropSettledChanges,
  listChangesMatchingServer,
  missingRefs,
  serviceChangesMatchingServer,
  variableChangesMatchingServer,
} from "./reconcile.ts";
import {
  listChangeId,
  listChangeValue,
  type TStageListInput,
  type TStagedChangesState,
  type TStagedListChange,
  type TStagedServiceChange,
  type TStagedVariableChange,
} from "./types.ts";

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

function service(
  field: TStagedServiceChange["field"],
  value: TStagedServiceChange["value"],
  overrides: Partial<TStagedServiceChange> = {},
) {
  const change: TStagedServiceChange = {
    id: `service:${overrides.serviceId ?? "api"}:${field}`,
    ...ids,
    serviceId: "api",
    serviceName: "api",
    field,
    value,
    label: field,
    displayValue: String(value),
    displayPrevious: "old",
    createdAt: 1,
    ...overrides,
  };
  return change;
}

type TOwnerKey = "teamId" | "projectId" | "environmentId" | "serviceId" | "serviceName";
type TListFields = TStageListInput extends infer T
  ? T extends unknown
    ? Omit<T, TOwnerKey>
    : never
  : never;

function list(fields: TListFields): TStagedListChange {
  const input: TStageListInput = { ...ids, serviceId: "api", serviceName: "api", ...fields };
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

test("dropSettledChanges removes settled changes that still hold the deployed value", () => {
  const a = variable("A", "1");
  const b = variable("B", "2");
  const replicas = service("replicaCount", 3);
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
  const replicas = service("replicaCount", 3);
  const cpu = service("cpuLimitMillicores", 500);
  const branch = service("gitBranch", "main");

  const result = serviceChangesMatchingServer(
    { replicaCount: replicas, cpuLimitMillicores: cpu, gitBranch: branch },
    { replicaCount: 3, cpuLimitMillicores: 250 },
  );

  assert.deepEqual(result, [replicas.id]);
});

test("serviceChangesMatchingServer compares boolean fields by value", () => {
  const stillPrivate = service("isPublic", false);
  const nowPublic = service("isPublic", true, { serviceId: "web" });

  assert.deepEqual(serviceChangesMatchingServer({ isPublic: stillPrivate }, { isPublic: false }), [
    stillPrivate.id,
  ]);
  assert.deepEqual(serviceChangesMatchingServer({ isPublic: nowPublic }, { isPublic: false }), []);
});

test("dropSettledChanges drops a settled list change unless it was re-staged", () => {
  const port = list({ kind: "port", port: 9000, op: "add" });
  const deployed = list({
    kind: "host",
    previous: null,
    value: { host: "app.example.com", port: 3000 },
    addsPort: false,
  });
  const restaged = list({
    kind: "host",
    previous: null,
    value: { host: "app.example.com", port: 8080 },
    addsPort: true,
  });
  const applying = { [port.id]: listChangeValue(port), [deployed.id]: listChangeValue(deployed) };

  const result = dropSettledChanges(
    state([], [], [port, restaged]),
    applying,
    new Set([port.id, deployed.id]),
  );

  assert.deepEqual(Object.keys(result.lists), [restaged.id]);
});

test("listChangesMatchingServer finds the list changes the server already has", () => {
  const added = list({
    kind: "host",
    previous: null,
    value: { host: "added.example.com", port: 3000 },
    addsPort: false,
  });
  const otherPort = list({
    kind: "host",
    previous: { host: "app.example.com", port: 3000 },
    value: { host: "app.example.com", port: 8080 },
    addsPort: true,
  });
  const halfRenamed = list({
    kind: "host",
    previous: { host: "old.example.com", port: 3000 },
    value: { host: "renamed.example.com", port: 3000 },
    addsPort: false,
  });
  const removed = list({
    kind: "host",
    previous: { host: "gone.example.com", port: 3000 },
    value: null,
    addsPort: false,
  });
  const portAdded = list({ kind: "port", port: 3000, op: "add" });
  const portStillThere = list({ kind: "port", port: 8080, op: "remove" });
  const portRemoved = list({ kind: "port", port: 9000, op: "remove" });

  const settled = listChangesMatchingServer(
    [added, otherPort, halfRenamed, removed, portAdded, portStillThere, portRemoved],
    {
      hosts: [
        { host: "added.example.com", port: 3000 },
        { host: "app.example.com", port: 3000 },
        { host: "old.example.com", port: 3000 },
        { host: "renamed.example.com", port: 3000 },
      ],
      ports: [3000, 8080],
    },
  );

  assert.deepEqual(settled, [added.id, removed.id, portAdded.id, portRemoved.id]);
});

test("listChangesMatchingServer leaves lists it was not given alone", () => {
  const port = list({ kind: "port", port: 3000, op: "add" });
  const volume = list({
    kind: "volume",
    volumeId: "pvc-1",
    volumeName: "data",
    mountPath: "/data",
  });

  const settled = listChangesMatchingServer([port, volume], {
    hosts: [{ host: "app.example.com", port: 3000 }],
  });

  assert.deepEqual(settled, []);
});

test("dropChangesReferencing drops every change that needs a deleted service", () => {
  const apiVariable = variable("A", "1");
  const apiReplicas = service("replicaCount", 3);
  const apiPort = list({ kind: "port", port: 3000, op: "add" });
  const mountOnApi = list({
    kind: "volume",
    volumeId: "pvc-1",
    volumeName: "data",
    mountPath: "/data",
  });
  const webReplicas = service("replicaCount", 2, { serviceId: "web", serviceName: "web" });
  const envVariable: TStagedVariableChange = {
    ...variable("SHARED", "1"),
    id: "variable:environment:SHARED",
    scope: { type: "environment", ...ids },
  };

  const result = dropChangesReferencing(
    state([apiVariable, envVariable], [apiReplicas, webReplicas], [apiPort, mountOnApi]),
    new Set(["api"]),
  );

  assert.deepEqual(Object.keys(result.variables), [envVariable.id]);
  assert.deepEqual(Object.keys(result.services), [webReplicas.id]);
  assert.deepEqual(Object.keys(result.lists), []);
});

test("dropChangesReferencing drops the mount of a deleted volume and backups to a deleted bucket", () => {
  const mount = list({ kind: "volume", volumeId: "pvc-1", volumeName: "data", mountPath: "/data" });
  const otherMount = list({
    kind: "volume",
    volumeId: "pvc-2",
    volumeName: "cache",
    mountPath: "/cache",
  });
  const bucket = service("s3BackupBucketId", "bucket-1");
  const replicas = service("replicaCount", 3);

  const result = dropChangesReferencing(
    state([], [bucket, replicas], [mount, otherMount]),
    new Set(["pvc-1", "bucket-1"]),
  );

  assert.deepEqual(Object.keys(result.services), [replicas.id]);
  assert.deepEqual(Object.keys(result.lists), [otherMount.id]);
});

test("dropChangesReferencing drops everything in a deleted environment or project", () => {
  const here = service("replicaCount", 3);
  const elsewhere = service("replicaCount", 2, {
    serviceId: "other",
    projectId: "project-2",
    environmentId: "env-2",
  });
  const current = state([variable("A", "1")], [here, elsewhere]);

  for (const deleted of ["env", "project"]) {
    const result = dropChangesReferencing(current, new Set([deleted]));
    assert.deepEqual(Object.keys(result.variables), []);
    assert.deepEqual(Object.keys(result.services), [elsewhere.id]);
  }
});

test("missingRefs reports services and volumes of the environment the server no longer lists", () => {
  const gone = service("replicaCount", 3, { serviceId: "gone" });
  const kept = service("replicaCount", 3);
  const otherEnv = service("replicaCount", 3, { serviceId: "far", environmentId: "env-2" });
  const mount = list({ kind: "volume", volumeId: "pvc-1", volumeName: "data", mountPath: "/data" });
  const current = state([variable("A", "1")], [gone, kept, otherEnv], [mount]);

  assert.deepEqual(missingRefs(current, "env", { serviceIds: ["api"] }), ["gone"]);
  assert.deepEqual(missingRefs(current, "env", { volumeIds: [] }), ["pvc-1"]);
  assert.deepEqual(missingRefs(current, "env", { volumeIds: ["pvc-1"] }), []);
  assert.deepEqual(missingRefs(current, "env", {}), []);
});
