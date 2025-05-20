import { createJSONZodStorage } from "@/lib/create-json-zod-storage";
import { z } from "zod";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

const UpdateStoreSchema = z.object({
  lastDismissedVersion: z.string().nullable(),
});

export type TState = z.infer<typeof UpdateStoreSchema>;

export type TActions = {
  setLastDismissedVersion: (version: string) => Promise<void>;
};

export type TUpdateStore = TState & TActions;

const defaultInitState: TState = {
  lastDismissedVersion: null,
};

const version = 0.001;

export const createUpdateStore = (initState: TState = defaultInitState) => {
  return createStore<TUpdateStore>()(
    persist(
      (set) => ({
        ...initState,
        setLastDismissedVersion: async (lastDismissedVersion) => {
          set((state) => ({
            ...state,
            lastDismissedVersion: lastDismissedVersion,
          }));
        },
      }),
      {
        name: "update_store",
        version,
        migrate: (state): TState => {
          const { error, data } = UpdateStoreSchema.safeParse(state);
          if (error) {
            console.log("Error on migration, falling back to empty UpdateStore:", error);
            return initState;
          }
          return data;
        },
        storage: createJSONZodStorage({
          getStorage: () => localStorage,
          schema: UpdateStoreSchema,
          fallback: initState,
          version,
        }),
      },
    ),
  );
};
