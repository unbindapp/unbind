import {
  ChangesStateSchema,
  serviceChangeId,
  variableChangeId,
  type TChangesState,
  type TStagedServiceChange,
  type TStagedVariableChange,
} from "@/components/changes/types";
import { createJSONZodStorage } from "@/lib/create-json-zod-storage";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type TStageVariableInput = Omit<TStagedVariableChange, "id" | "createdAt">;

export type TStageServiceInput = Omit<TStagedServiceChange, "id" | "createdAt"> & {
  // The value equals what the server has, so nothing is left to deploy
  isDefault: boolean;
};

export type TChangesActions = {
  stageVariables: (changes: TStageVariableInput[]) => void;
  stageService: (change: TStageServiceInput) => void;
  discard: (ids: string[]) => void;
  discardService: (serviceId: string) => void;
  discardAll: () => void;
  keepOnly: (ids: Set<string>) => void;
};

export type TChangesStore = TChangesState & TChangesActions;

const defaultInitState: TChangesState = {
  variables: {},
  services: {},
};

const version = 0.001;

export const createChangesStore = (initState: TChangesState = defaultInitState) => {
  return createStore<TChangesStore>()(
    persist(
      (set) => ({
        ...initState,
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
            const services = { ...state.services };
            if (isDefault) {
              delete services[id];
              return { services };
            }
            services[id] = { ...change, id, createdAt: services[id]?.createdAt ?? Date.now() };
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
        keepOnly: (ids) =>
          set((state) => ({
            variables: Object.fromEntries(
              Object.entries(state.variables).filter(([id]) => ids.has(id)),
            ),
            services: Object.fromEntries(
              Object.entries(state.services).filter(([id]) => ids.has(id)),
            ),
          })),
      }),
      {
        name: "changes_store",
        version,
        partialize: (state) => ({ variables: state.variables, services: state.services }),
        migrate: (state): TChangesState => {
          const { error, data } = ChangesStateSchema.safeParse(state);
          if (error) {
            console.log("Error on migration, falling back to empty ChangesStore:", error);
            return initState;
          }
          return data;
        },
        // Tab-scoped on purpose: values are secrets and must not outlive the tab
        storage: createJSONZodStorage({
          getStorage: () => sessionStorage,
          schema: ChangesStateSchema,
          fallback: initState,
          version,
        }),
      },
    ),
  );
};
