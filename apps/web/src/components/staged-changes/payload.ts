// Relative imports so this can run under `node --test`.
import {
  variableScopeKey,
  type TStagedChangesState,
  type TStagedServiceChange,
  type TStagedVariableChange,
} from "./types.ts";
import {
  toUpdateServiceInput,
  type TUpdateServiceInput,
} from "../../lib/queries/update-service-input.ts";
import type {
  ChangeFailure,
  ChangeSetVariables,
  UpdateServiceInput,
} from "../../lib/server/client.gen.ts";

export type TApplyChangesPayload = {
  variables: ChangeSetVariables[];
  services: UpdateServiceInput[];
};

export function buildApplyChangesPayload(state: TStagedChangesState): TApplyChangesPayload {
  return {
    variables: variableChangeSets(Object.values(state.variables)),
    services: serviceUpdates(Object.values(state.services)),
  };
}

export function variableChangeSets(changes: TStagedVariableChange[]): ChangeSetVariables[] {
  const byScope = new Map<string, ChangeSetVariables>();
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

export function serviceUpdates(changes: TStagedServiceChange[]) {
  const byService = new Map<string, TUpdateServiceInput>();
  for (const change of sortByCreation(changes)) {
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
    Object.assign(input, { [change.field]: change.value });
  }
  return [...byService.values()].map(toUpdateServiceInput);
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
  for (const change of Object.values(state.services)) {
    if (failedServices.has(change.serviceId)) keep.add(change.id);
  }
  for (const change of Object.values(state.variables)) {
    if (failedScopes.has(variableScopeKey(change.scope))) keep.add(change.id);
  }
  return keep;
}
