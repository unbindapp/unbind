import type { TBarEdge } from "@/components/staged-changes/bar-position";
import { dropSettledChanges, type TApplyingValues } from "@/components/staged-changes/reconcile";
import {
  StagedChangesStateSchema,
  serviceChangeId,
  variableChangeId,
  type TStagedChangesState,
  type TStagedServiceChange,
  type TStagedVariableChange,
} from "@/components/staged-changes/types";
import { createJSONZodStorage } from "@/lib/create-json-zod-storage";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type TStageVariableInput = Omit<TStagedVariableChange, "id" | "createdAt">;

export type TStageServiceInput = Omit<TStagedServiceChange, "id" | "createdAt"> & {
  // The value equals what the server has, so nothing is left to deploy
  isDefault: boolean;
};

// Not persisted: the bar edge is set by a drawer while it's open, so the bar keeps out of
// its way. The applying values are the deploy in flight; a reload must not resurrect it
export type TStagedChangesTransientState = {
  barPinnedEdge: TBarEdge | null;
  applying: TApplyingValues;
};

export type TStagedChangesActions = {
  setBarPinnedEdge: (edge: TBarEdge | null) => void;
  beginApplying: () => void;
  // Settled changes were applied by the server and leave the stage
  endApplying: (settled: Set<string>) => void;
  stageVariables: (changes: TStageVariableInput[]) => void;
  stageService: (change: TStageServiceInput) => void;
  discard: (ids: string[]) => void;
  discardService: (serviceId: string) => void;
  discardAll: () => void;
};

export type TStagedChangesStore = TStagedChangesState &
  TStagedChangesTransientState &
  TStagedChangesActions;

const defaultInitState: TStagedChangesState = {
  variables: {},
  services: {},
};

const version = 0.002;

export const createStagedChangesStore = (initState: TStagedChangesState = defaultInitState) => {
  return createStore<TStagedChangesStore>()(
    persist(
      (set) => ({
        ...initState,
        barPinnedEdge: null,
        applying: {},
        setBarPinnedEdge: (barPinnedEdge) => set({ barPinnedEdge }),
        beginApplying: () =>
          set((state) => ({
            applying: Object.fromEntries(
              [...Object.values(state.variables), ...Object.values(state.services)].map(
                (change) => [change.id, change.value],
              ),
            ),
          })),
        endApplying: (settled) =>
          set((state) => ({ ...dropSettledChanges(state, state.applying, settled), applying: {} })),
        stageVariables: (changes) =>
          set((state) => {
            const variables = { ...state.variables };
            for (const change of changes) {
              const id = variableChangeId(change.scope, change.name);
              if (change.value === change.previous) {
                delete variables[id];
                continue;
              }
              variables[id] = {
                ...change,
                id,
                createdAt: variables[id]?.createdAt ?? Date.now(),
              };
            }
            return { variables };
          }),
        stageService: ({ isDefault, ...change }) =>
          set((state) => {
            const id = serviceChangeId(change.serviceId, change.field);
            const existing = state.services[id];
            if (isDefault && !existing) return state;
            if (
              existing?.value === change.value &&
              existing.displayPrevious === change.displayPrevious
            ) {
              return state;
            }
            const services = { ...state.services };
            if (isDefault) {
              delete services[id];
              return { services };
            }
            services[id] = { ...change, id, createdAt: existing?.createdAt ?? Date.now() };
            return { services };
          }),
        discard: (ids) =>
          set((state) => {
            const variables = { ...state.variables };
            const services = { ...state.services };
            for (const id of ids) {
              delete variables[id];
              delete services[id];
            }
            return { variables, services };
          }),
        discardService: (serviceId) =>
          set((state) => ({
            variables: Object.fromEntries(
              Object.entries(state.variables).filter(
                ([, change]) => change.scope.serviceId !== serviceId,
              ),
            ),
            services: Object.fromEntries(
              Object.entries(state.services).filter(([, change]) => change.serviceId !== serviceId),
            ),
          })),
        discardAll: () => set({ variables: {}, services: {} }),
      }),
      {
        name: "staged_changes_store",
        version,
        partialize: (state) => ({ variables: state.variables, services: state.services }),
        migrate: (state): TStagedChangesState => {
          const { error, data } = StagedChangesStateSchema.safeParse(state);
          if (error) {
            console.log("Error on migration, falling back to empty StagedChangesStore:", error);
            return initState;
          }
          return data;
        },
        // Tab-scoped on purpose: values are secrets and must not outlive the tab
        storage: createJSONZodStorage({
          getStorage: () => sessionStorage,
          schema: StagedChangesStateSchema,
          fallback: initState,
          version,
        }),
      },
    ),
  );
};
