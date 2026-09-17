import type { z } from "zod";

const draftVersion = 0;
const draftKeyPrefix = "unbind-form-draft:";

export type TDraftStorageType = "session" | "local";

export type TDraftEntry<T> = {
  type: TDraftStorageType;
  key: string;
  schema: z.ZodType<T>;
};

function getStorage(type: TDraftStorageType) {
  if (typeof window === "undefined") return undefined;
  return type === "session" ? window.sessionStorage : window.localStorage;
}

export function readDraft<T>({ type, key, schema }: TDraftEntry<T>) {
  const storage = getStorage(type);
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(draftKeyPrefix + key);
    if (!raw) return undefined;
    const envelope: unknown = JSON.parse(raw);
    if (
      typeof envelope !== "object" ||
      envelope === null ||
      !("values" in envelope) ||
      !("version" in envelope) ||
      envelope.version !== draftVersion
    ) {
      storage.removeItem(draftKeyPrefix + key);
      return undefined;
    }
    const result = schema.safeParse(envelope.values);
    if (!result.success) {
      storage.removeItem(draftKeyPrefix + key);
      return undefined;
    }
    return result.data;
  } catch (error) {
    console.error(`Form draft | Failed to read "${key}":`, error);
    return undefined;
  }
}

export function writeDraft<T>({ type, key }: Pick<TDraftEntry<T>, "type" | "key">, values: T) {
  const storage = getStorage(type);
  if (!storage) return;
  try {
    storage.setItem(
      draftKeyPrefix + key,
      JSON.stringify({ version: draftVersion, updatedAt: new Date().toISOString(), values }),
    );
  } catch (error) {
    console.error(`Form draft | Failed to write "${key}":`, error);
  }
}

export function removeDraft({ type, key }: { type: TDraftStorageType; key: string }) {
  const storage = getStorage(type);
  if (!storage) return;
  try {
    storage.removeItem(draftKeyPrefix + key);
  } catch (error) {
    console.error(`Form draft | Failed to remove "${key}":`, error);
  }
}

// View state saved next to a draft lives under "<key>:<suffix>", so it goes with the draft
export function removeDraftWithViewState({ type, key }: { type: TDraftStorageType; key: string }) {
  const storage = getStorage(type);
  if (!storage) return;
  try {
    const viewStatePrefix = draftKeyPrefix + key + ":";
    const keysToRemove = [draftKeyPrefix + key];
    for (let i = 0; i < storage.length; i++) {
      const storageKey = storage.key(i);
      if (storageKey?.startsWith(viewStatePrefix)) keysToRemove.push(storageKey);
    }
    for (const storageKey of keysToRemove) storage.removeItem(storageKey);
  } catch (error) {
    console.error(`Form draft | Failed to remove "${key}":`, error);
  }
}
