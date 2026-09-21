// Relative imports so this can run under `node --test`.
import {
  variableScopeKey,
  type TStagedChangesState,
  type TStagedListChange,
  type TStagedServiceChange,
  type TStagedVariableChange,
} from "./types.ts";
import {
  toUpdateServiceInput,
  type TUpdateServiceInput,
} from "../../lib/queries/update-service-input.ts";
import type {
  ChangeFailure,
  StagedVariables,
  UpdateServiceInput,
} from "../../lib/server/client.gen.ts";

export type TApplyStagedChangesPayload = {
  variables: StagedVariables[];
  services: UpdateServiceInput[];
};

export function buildApplyStagedChangesPayload(
  state: TStagedChangesState,
): TApplyStagedChangesPayload {
  return {
    variables: variableChangeSets(Object.values(state.variables)),
    services: serviceUpdates(Object.values(state.services), Object.values(state.lists)),
  };
}

export function variableChangeSets(changes: TStagedVariableChange[]): StagedVariables[] {
  const byScope = new Map<string, StagedVariables>();
  for (const change of sortByCreation(changes)) {
    const key = variableScopeKey(change.scope);
    let set = byScope.get(key);
    if (!set) {
      set = {
        type: change.scope.type,
        team_id: change.scope.teamId,
        project_id: change.scope.projectId,
        environment_id: change.scope.environmentId,
        service_id: change.scope.serviceId,
        upserts: [],
        deletes: [],
      };
      byScope.set(key, set);
    }
    if (change.value === null) {
      set.deletes!.push(change.name);
      continue;
    }
    set.upserts!.push({ name: change.name, value: change.value });
  }
  return [...byScope.values()];
}

export function serviceUpdates(
  changes: TStagedServiceChange[],
  listChanges: TStagedListChange[] = [],
) {
  const byService = new Map<string, TUpdateServiceInput>();
  const inputFor = (change: TStagedServiceChange | TStagedListChange) => {
    let input = byService.get(change.serviceId);
    if (!input) {
      input = {
        teamId: change.teamId,
        projectId: change.projectId,
        environmentId: change.environmentId,
        serviceId: change.serviceId,
      };
      byService.set(change.serviceId, input);
    }
    return input;
  };

  for (const change of sortByCreation(changes)) {
    Object.assign(inputFor(change), { [change.field]: change.value });
  }
  for (const change of sortByCreation(listChanges)) {
    addListChange(inputFor(change), change);
  }
  return [...byService.values()].map(toUpdateServiceInput);
}

function addListChange(input: TUpdateServiceInput, change: TStagedListChange) {
  if (change.kind === "volume") {
    input.addVolumes = [
      ...(input.addVolumes ?? []),
      { id: change.volumeId, mount_path: change.mountPath },
    ];
    return;
  }
  if (change.kind === "port") {
    if (change.op === "remove") {
      input.removePorts = [...(input.removePorts ?? []), { port: change.port }];
      return;
    }
    addPort(input, change.port);
    return;
  }
  if (change.value === null) {
    if (!change.previous) return;
    input.removeHosts = [
      ...(input.removeHosts ?? []),
      { host: change.previous.host, path: "", target_port: change.previous.port },
    ];
    return;
  }
  input.upsertHosts = [
    ...(input.upsertHosts ?? []),
    {
      host: change.value.host,
      path: "",
      target_port: change.value.port,
      prev_host: change.previous?.host,
    },
  ];
  if (change.addsPort && change.value.port !== undefined) addPort(input, change.value.port);
}

// Two domains can bring the same new port
function addPort(input: TUpdateServiceInput, port: number) {
  if (input.addPorts?.some((p) => p.port === port)) return;
  input.addPorts = [...(input.addPorts ?? []), { port }];
}

function sortByCreation<T extends { createdAt: number }>(changes: T[]) {
  return [...changes].sort((a, b) => a.createdAt - b.createdAt);
}

// A failed deploy keeps the changes it could not apply; everything else was persisted
export function idsToKeepAfterFailures(state: TStagedChangesState, failures: ChangeFailure[]) {
  const failedServices = new Set<string>();
  const failedScopes = new Set<string>();
  for (const failure of failures) {
    if (failure.service_id) failedServices.add(failure.service_id);
    if (!failure.variables) continue;
    failedScopes.add(
      variableScopeKey({
        type: failure.variables.type,
        teamId: failure.variables.team_id,
        projectId: failure.variables.project_id,
        environmentId: failure.variables.environment_id,
        serviceId: failure.variables.service_id,
      }),
    );
  }

  const keep = new Set<string>();
  for (const change of [...Object.values(state.services), ...Object.values(state.lists)]) {
    if (failedServices.has(change.serviceId)) keep.add(change.id);
  }
  for (const change of Object.values(state.variables)) {
    if (failedScopes.has(variableScopeKey(change.scope))) keep.add(change.id);
  }
  return keep;
}
