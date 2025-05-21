import { createJSONZodStorage } from "@/lib/create-json-zod-storage";
import { z } from "zod";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

const maxNewlyCreatedEntitiesToStore = 20;

const NewlyCreatedEntitySchema = z.object({
  createdAtTimestamp: z.number(),
  expiresAtTimestamp: z.number(),
  isOpened: z.boolean(),
});

const MainStoreSchema = z.object({
  lastDismissedVersion: z.string().nullable(),
  newlyCreatedEntities: z.record(z.string(), NewlyCreatedEntitySchema),
});

export type TState = z.infer<typeof MainStoreSchema>;

export type TActions = {
  setLastDismissedVersion: (version: string) => Promise<void>;
  addNewlyCreatedEntity: (entityId: string, expiresAtTimestamp: number) => Promise<void>;
  removeNewlyCreatedEntityWithDelay: (entityId: string, delayMs: number) => Promise<void>;
  removeOldNewlyCreatedEntities: () => Promise<void>;
  onNewlyCreatedEntityOpened: (props: { entityId: string; shouldDelete: boolean }) => Promise<void>;
};

export type TMainStore = TState & TActions;

const defaultInitState: TState = {
  lastDismissedVersion: null,
  newlyCreatedEntities: {},
};

const version = 0.001;

export const createMainStore = (initState: TState = defaultInitState) => {
  return createStore<TMainStore>()(
    persist(
      (set) => ({
        ...initState,
        setLastDismissedVersion: async (lastDismissedVersion) => {
          set((state) => ({
            ...state,
            lastDismissedVersion: lastDismissedVersion,
          }));
        },
        addNewlyCreatedEntity: async (entityId, expiresAtTimestamp) => {
          set((state) => {
            const updatedEntities = { ...state.newlyCreatedEntities };
            const now = Date.now();
            for (const key in updatedEntities) {
              const entity = updatedEntities[key];
              if (now > entity.expiresAtTimestamp) {
                delete updatedEntities[key];
              }
            }
            const newSize = Object.keys(updatedEntities).length + 1;
            if (newSize > maxNewlyCreatedEntitiesToStore) {
              const idsToDelete = Object.entries(updatedEntities)
                .sort((a, b) => a[1].createdAtTimestamp - b[1].createdAtTimestamp)
                .slice(0, newSize - maxNewlyCreatedEntitiesToStore)
                .map(([id]) => id);
              idsToDelete.forEach((id) => {
                delete updatedEntities[id];
              });
            }
            updatedEntities[entityId] = {
              createdAtTimestamp: Date.now(),
              expiresAtTimestamp,
              isOpened: false,
            };
            return {
              ...state,
              newlyCreatedEntities: updatedEntities,
            };
          });
        },
        removeNewlyCreatedEntityWithDelay: async (entityId, delay) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          set((state) => {
            const updatedEntities = { ...state.newlyCreatedEntities };
            delete updatedEntities[entityId];
            return {
              ...state,
              newlyCreatedEntities: updatedEntities,
            };
          });
        },
        onNewlyCreatedEntityOpened: async ({ entityId, shouldDelete }) => {
          set((state) => {
            const updatedEntities = { ...state.newlyCreatedEntities };
            if (shouldDelete) {
              delete updatedEntities[entityId];
            } else if (updatedEntities[entityId]) {
              const entity = updatedEntities[entityId];
              if (entity) updatedEntities[entityId] = { ...entity, isOpened: true };
            }
            return {
              ...state,
              newlyCreatedEntities: updatedEntities,
            };
          });
        },
        removeOldNewlyCreatedEntities: async () => {
          set((state) => {
            const updatedEntities = { ...state.newlyCreatedEntities };
            const now = Date.now();
            for (const key in updatedEntities) {
              const entity = updatedEntities[key];
              if (now > entity.expiresAtTimestamp) {
                delete updatedEntities[key];
              }
            }
            return {
              ...state,
              newlyCreatedEntities: updatedEntities,
            };
          });
        },
      }),
      {
        name: "main_store",
        version,
        migrate: (state): TState => {
          const { error, data } = MainStoreSchema.safeParse(state);
          if (error) {
            console.log("Error on migration, falling back to empty MainStore:", error);
            return initState;
          }
          return data;
        },
        storage: createJSONZodStorage({
          getStorage: () => localStorage,
          schema: MainStoreSchema,
          fallback: initState,
          version,
        }),
        onRehydrateStorage: () => (state, error) => {
          if (error || !state) return;
          state.removeOldNewlyCreatedEntities();
        },
      },
    ),
  );
};
