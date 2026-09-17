import {
  readDraft,
  removeDraft,
  removeDraftWithViewState,
  writeDraft,
  type TDraftEntry,
  type TDraftStorageType,
} from "@/lib/form-draft-storage";
import { useAppForm } from "@/lib/hooks/use-app-form";
import type {
  AnyFormApi,
  FormAsyncValidateOrFn,
  FormOptions,
  FormValidateOrFn,
} from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { z } from "zod";

const saveDebounceMs = 300;

export type TFormPersistenceType = "none" | TDraftStorageType;

export type TFormPersistenceProps<TFormData> =
  | { persistenceType?: "none"; persistenceKey?: never; persistenceSchema?: never }
  | {
      // "local" outlives the tab. Never use it for forms carrying secrets (variables, credentials).
      persistenceType: TDraftStorageType;
      persistenceKey: string;
      persistenceSchema: z.ZodType<TFormData>;
    };

export function removeFormDraft({
  persistenceType,
  persistenceKey,
}: {
  persistenceType: TDraftStorageType;
  persistenceKey: string;
}) {
  removeDraftWithViewState({ type: persistenceType, key: persistenceKey });
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

  const [persistence] = useState<TDraftEntry<TFormData> | undefined>(() => {
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
        removeDraft(persistence);
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
