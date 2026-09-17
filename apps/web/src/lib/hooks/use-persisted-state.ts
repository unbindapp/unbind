import {
  readDraft,
  removeDraft,
  writeDraft,
  type TDraftStorageType,
} from "@/lib/form-draft-storage";
import { useCallback, useState } from "react";
import { z } from "zod";

export const PersistedBooleanSchema = z.boolean();

type TProps<T> = {
  type?: TDraftStorageType;
  // Without a key this is plain useState. For view state of a persisted form, use
  // "<persistenceKey>:<suffix>" so removeFormDraft clears it together with the draft.
  key: string | undefined;
  schema: z.ZodType<T>;
  defaultValue: T;
};

export function usePersistedState<T extends boolean | string | number>({
  type = "session",
  key,
  schema,
  defaultValue,
}: TProps<T>) {
  const read = () => (key ? readDraft({ type, key, schema }) : undefined) ?? defaultValue;

  const [state, setState] = useState(() => ({ key, value: read() }));
  const current = state.key === key ? state : { key, value: read() };
  if (current !== state) setState(current);

  const setValue = useCallback(
    (value: T) => {
      setState({ key, value });
      if (!key) return;
      if (value === defaultValue) {
        removeDraft({ type, key });
        return;
      }
      writeDraft({ type, key }, value);
    },
    [type, key, defaultValue],
  );

  return [current.value, setValue] as const;
}
