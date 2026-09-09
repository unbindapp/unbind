// Relative imports so this can run under `node --test`.
import type {
  TServiceChangeField,
  TStagedChangesState,
  TStagedServiceChange,
  TStagedValue,
  TStagedVariableChange,
} from "./types.ts";

// The values each change had when the deploy started, keyed by change id
export type TApplyingValues = Record<string, TStagedValue>;

// Settled changes leave the stage unless they were re-staged with another value in the meantime
export function dropSettledChanges(
  state: TStagedChangesState,
  applying: TApplyingValues,
  settled: Set<string>,
): TStagedChangesState {
  const isSettled = (id: string, value: TStagedValue) =>
    settled.has(id) && id in applying && applying[id] === value;
  return {
    variables: Object.fromEntries(
      Object.entries(state.variables).filter(([id, change]) => !isSettled(id, change.value)),
    ),
    services: Object.fromEntries(
      Object.entries(state.services).filter(([id, change]) => !isSettled(id, change.value)),
    ),
  };
}

// Ids of staged variables the server already has in the staged state, so there is nothing to deploy
export function variableChangesMatchingServer(
  staged: Iterable<TStagedVariableChange>,
  serverValues: Map<string, string>,
): string[] {
  const ids: string[] = [];
  for (const change of staged) {
    const serverValue = serverValues.get(change.name);
    if (change.value === null && serverValue === undefined) {
      ids.push(change.id);
      continue;
    }
    if (change.value !== null && change.value === serverValue) ids.push(change.id);
  }
  return ids;
}

export function serviceChangesMatchingServer(
  staged: Partial<Record<TServiceChangeField, TStagedServiceChange>>,
  serverValues: Partial<Record<TServiceChangeField, string | number>>,
): string[] {
  const ids: string[] = [];
  for (const change of Object.values(staged)) {
    if (!(change.field in serverValues)) continue;
    if (change.value === serverValues[change.field]) ids.push(change.id);
  }
  return ids;
}
