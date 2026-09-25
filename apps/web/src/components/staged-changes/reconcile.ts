// Relative imports so this can run under `node --test`.
import {
  listChangeValue,
  type THostTarget,
  type TServiceChangeField,
  type TStagedChangesState,
  type TStagedListChange,
  type TStagedServiceChange,
  type TStagedValue,
  type TStagedVariableChange,
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
    lists: Object.fromEntries(
      Object.entries(state.lists).filter(([id, change]) => !isSettled(id, listChangeValue(change))),
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
  serverValues: Partial<Record<TServiceChangeField, string | number | boolean>>,
): string[] {
  const ids: string[] = [];
  for (const change of Object.values(staged)) {
    if (!(change.field in serverValues)) continue;
    if (change.value === serverValues[change.field]) ids.push(change.id);
  }
  return ids;
}

export type TServerLists = {
  hosts?: THostTarget[];
  ports?: number[];
};

// A list that is left out is unknown, so its changes stay staged. Volumes are not
// checked here, the volume's connection section drops its change once the server has it
export function listChangesMatchingServer(
  staged: Iterable<TStagedListChange>,
  { hosts, ports }: TServerLists,
): string[] {
  const ids: string[] = [];
  for (const change of staged) {
    if (change.kind === "port") {
      if (!ports) continue;
      if (ports.includes(change.port) === (change.op === "add")) ids.push(change.id);
      continue;
    }
    if (change.kind === "volume") continue;
    if (!hosts) continue;
    const { value, previous } = change;
    if (value === null) {
      if (!hosts.some((h) => h.host === previous?.host)) ids.push(change.id);
      continue;
    }
    const isRenamed = previous !== null && previous.host !== value.host;
    if (isRenamed && hosts.some((h) => h.host === previous.host)) continue;
    if (hosts.some((h) => h.host === value.host && h.port === value.port)) ids.push(change.id);
  }
  return ids;
}
