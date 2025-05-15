import { toast } from "sonner";
import { z } from "zod";
import { PersistStorage, createJSONStorage } from "zustand/middleware";

export function createJSONZodStorage<T>({
  getStorage,
  schema,
  fallback,
  version,
}: {
  getStorage: () => Storage;
  schema: z.ZodType<T>;
  fallback: T;
  version: number;
}): PersistStorage<T> {
  if (typeof window === "undefined") {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    };
  }
  const jsonStorage = createJSONStorage<T>(() => getStorage());

  if (!jsonStorage) {
    throw new Error("Storage | Failed to create JSON storage");
  }

  return {
    getItem: async (name) => {
      const value = (await jsonStorage.getItem(name)) || null;

      if (value === null) {
        return null;
      }

      try {
        const result = schema.safeParse(value.state);
        if (result.success) {
          return value;
        } else {
          console.warn(`Storage | Validation failed for "${name}:`, result.error);
          return { state: fallback, version };
        }
      } catch (error) {
        console.error(`Storage | Error validating "${name}:`, error);
        return { state: fallback, version };
      }
    },

    setItem: async (name, value) => {
      try {
        const result = schema.safeParse(value.state);
        if (result.success) {
          await jsonStorage.setItem(name, value);
        } else {
          toast.error(`Couldn't save to storage`, {
            description: `Validation failed. Couldn't save "${name}" to storage`,
          });
          console.error(
            `Storage | Validation failed, couldn't save "${name}" to storage:`,
            result.error,
          );
        }
      } catch (error) {
        console.error(`Storage | Error saving "${name}" to storage:`, error);
      }
    },

    removeItem: (name) => jsonStorage.removeItem(name),
  };
}
