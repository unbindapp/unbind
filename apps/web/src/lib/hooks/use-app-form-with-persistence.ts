import { useAppForm } from "@/lib/hooks/use-app-form";
import type {
  AnyFormApi,
  FormAsyncValidateOrFn,
  FormOptions,
  FormValidateOrFn,
} from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { z } from "zod";

const draftVersion = 0;
const draftKeyPrefix = "unbind-form-draft:";
const saveDebounceMs = 300;

export type TFormPersistenceType = "none" | "session" | "local";

export type TFormPersistenceProps<TFormData> =
  | { persistenceType?: "none"; persistenceKey?: never; persistenceSchema?: never }
  | {
      // "local" outlives the tab. Never use it for forms carrying secrets (variables, credentials).
      persistenceType: "session" | "local";
      persistenceKey: string;
      persistenceSchema: z.ZodType<TFormData>;
    };

type TPersistence<TFormData> = {
  type: "session" | "local";
  key: string;
  schema: z.ZodType<TFormData>;
};

function getStorage(type: "session" | "local") {
  if (typeof window === "undefined") return undefined;
  return type === "session" ? window.sessionStorage : window.localStorage;
}

function readDraft<TFormData>({ type, key, schema }: TPersistence<TFormData>) {
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

function writeDraft<TFormData>({ type, key }: TPersistence<TFormData>, values: TFormData) {
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

export function removeFormDraft({
  persistenceType,
  persistenceKey,
}: {
  persistenceType: "session" | "local";
  persistenceKey: string;
}) {
  const storage = getStorage(persistenceType);
  if (!storage) return;
  try {
    storage.removeItem(draftKeyPrefix + persistenceKey);
  } catch (error) {
    console.error(`Form draft | Failed to remove "${persistenceKey}":`, error);
  }
}

export function useAppFormWithPersistence<
  TFormData,
  TOnMount extends undefined | FormValidateOrFn<TFormData>,
  TOnChange extends undefined | FormValidateOrFn<TFormData>,
  TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnBlur extends undefined | FormValidateOrFn<TFormData>,
  TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnSubmit extends undefined | FormValidateOrFn<TFormData>,
  TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnDynamic extends undefined | FormValidateOrFn<TFormData>,
  TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>,
  TSubmitMeta,
>(
  props: FormOptions<
    TFormData,
    TOnMount,
    TOnChange,
    TOnChangeAsync,
    TOnBlur,
    TOnBlurAsync,
    TOnSubmit,
    TOnSubmitAsync,
    TOnDynamic,
    TOnDynamicAsync,
    TOnServer,
    TSubmitMeta
  > &
    TFormPersistenceProps<TFormData>,
) {
  const { persistenceType, persistenceKey, persistenceSchema, ...formOptions } = props;

  const [persistence] = useState<TPersistence<TFormData> | undefined>(() => {
    if (persistenceType !== "session" && persistenceType !== "local") return undefined;
    if (!persistenceKey || !persistenceSchema) return undefined;
    return { type: persistenceType, key: persistenceKey, schema: persistenceSchema };
  });
  const [draft] = useState(() => (persistence ? readDraft(persistence) : undefined));

  const form = useAppForm(
    formOptions as FormOptions<
      TFormData,
      TOnMount,
      TOnChange,
      TOnChangeAsync,
      TOnBlur,
      TOnBlurAsync,
      TOnSubmit,
      TOnSubmitAsync,
      TOnDynamic,
      TOnDynamicAsync,
      TOnServer,
      TSubmitMeta
    >,
  );

  useEffect(() => {
    if (!persistence) return;

    // setFieldValue marks fields touched, which stops later defaultValues
    // updates (e.g. async auto-generated domains) from overwriting the draft
    if (typeof draft === "object" && draft !== null) {
      for (const [key, value] of Object.entries(draft)) {
        (form as AnyFormApi).setFieldValue(key, value);
      }
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let lastSerializedValues: string | undefined;

    const persistNow = () => {
      const values = form.state.values;
      if (JSON.stringify(values) === JSON.stringify(form.options.defaultValues)) {
        removeFormDraft({ persistenceType: persistence.type, persistenceKey: persistence.key });
        return;
      }
      writeDraft(persistence, values);
    };

    const subscription = form.store.subscribe(() => {
      const serializedValues = JSON.stringify(form.state.values);
      if (serializedValues === lastSerializedValues) return;
      lastSerializedValues = serializedValues;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(persistNow, saveDebounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (!timeout) return;
      clearTimeout(timeout);
      persistNow();
    };
  }, [form, persistence, draft]);

  return form;
}
