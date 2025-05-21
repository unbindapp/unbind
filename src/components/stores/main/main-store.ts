import { createJSONZodStorage } from "@/lib/create-json-zod-storage";
import { z } from "zod";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

const maxNewlyCreatedEntitiesToStore = 20;
const newThreshold = 1000 * 60 * 5;
const defaultRemoveDelay = 1000 * 4;

const NewlyCreatedEntitySchema = z.object({
  timestamp: z.number(),
  isOpened: z.boolean(),
});

const MainStoreSchema = z.object({
  lastDismissedVersion: z.string().nullable(),
  newlyCreatedEntities: z.map(z.string(), NewlyCreatedEntitySchema),
});

export type TState = z.infer<typeof MainStoreSchema>;

export type TActions = {
  setLastDismissedVersion: (version: string) => Promise<void>;
  addNewlyCreatedEntity: (entityId: string) => Promise<void>;
  removeNewlyCreatedEntity: (entityId: string) => Promise<void>;
  removeNewlyCreatedEntityWithDelay: (entityId: string, delay?: number) => Promise<void>;
  onNewlyCreatedEntityOpened: (props: { entityId: string; shouldDelete: boolean }) => Promise<void>;
};

export type TMainStore = TState & TActions;

const defaultInitState: TState = {
  lastDismissedVersion: null,
  newlyCreatedEntities: new Map(),
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
        addNewlyCreatedEntity: async (entityId) => {
          set((state) => {
            const updatedEntities = new Map(state.newlyCreatedEntities);
            updatedEntities.forEach((entity, key) => {
              if (Date.now() - entity.timestamp > newThreshold) {
                updatedEntities.delete(key);
              }
            });
            const newSize = updatedEntities.size + 1;
            if (newSize > maxNewlyCreatedEntitiesToStore) {
              const entitiesToDelete = Array.from(updatedEntities.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, newSize - maxNewlyCreatedEntitiesToStore);
              entitiesToDelete.forEach(([key]) => {
                updatedEntities.delete(key);
              });
            }
            updatedEntities.set(entityId, { timestamp: Date.now(), isOpened: false });
            return {
              ...state,
              newlyCreatedEntities: updatedEntities,
            };
          });
        },
        removeNewlyCreatedEntityWithDelay: async (entityId, delay = defaultRemoveDelay) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          set((state) => {
            const updatedEntities = new Map(state.newlyCreatedEntities);
            updatedEntities.delete(entityId);
            return {
              ...state,
              newlyCreatedEntities: updatedEntities,
            };
          });
        },
        removeNewlyCreatedEntity: async (entityId) => {
          set((state) => {
            const updatedEntities = new Map(state.newlyCreatedEntities);
            updatedEntities.delete(entityId);
            return {
              ...state,
              newlyCreatedEntities: updatedEntities,
            };
          });
        },
        onNewlyCreatedEntityOpened: async ({ entityId, shouldDelete }) => {
          set((state) => {
            const updatedEntities = new Map(state.newlyCreatedEntities);
            if (shouldDelete) {
              updatedEntities.delete(entityId);
            } else if (updatedEntities.has(entityId)) {
              const entity = updatedEntities.get(entityId);
              if (entity) updatedEntities.set(entityId, { ...entity, isOpened: true });
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
      },
    ),
  );
};
