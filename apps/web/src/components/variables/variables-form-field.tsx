import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type { TTokenFieldHandle, TTokenFieldProps } from "@/components/ui/token-field/token-field";
import BrandIcon from "@/components/icons/brand";
import { IconCache, type TCachedIcon } from "@/components/icons/icon-cache";
import { iconCompletionAddition } from "@/components/ui/token-field/icon-completion";
import { getVariablesFromRawText } from "@/components/variables/helpers";
import {
  createVariableReferenceLanguage,
  loadingReferencesIconKey,
  type TVariableReferenceData,
} from "@/components/variables/variable-reference-language";
import { createEnvVariablesLanguage } from "@/components/variables/variables-env-language";
import { resolveReferenceInsertion } from "@/components/variables/variable-reference-completion";
import { referenceLabelCompletionAddition } from "@/components/variables/variable-reference-label";
import type { TReferenceExtended, TVariableToken } from "@/components/variables/tokens";
import { withForm } from "@/lib/hooks/use-app-form";
import type { LanguageSupport } from "@codemirror/language";
import type { AnyFieldApi } from "@tanstack/react-form";
import { TVariableForCreate } from "@/lib/queries/variables";
import { InfoIcon, Link2Icon, LoaderIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useRef, type FC } from "react";

export type TReferenceProps = {
  /** undefined while references are loading */
  tokens: readonly TVariableToken<TReferenceExtended>[] | undefined;
  /** References are unavailable in this scope, so the field is plain text. */
  disabled?: boolean;
};

export const variablesFormFieldDefaultVariables: TVariableForCreate[] = [{ name: "", value: "" }];

export const referenceCompletionAdditions = [
  iconCompletionAddition,
  referenceLabelCompletionAddition,
];

/**
 * The CodeMirror language and completion icons for a field that takes
 * references. The language is rebuilt when the reference list arrives so
 * already-typed values re-colour.
 */
export function useVariableReferenceLanguage(
  tokens: readonly TVariableToken<TReferenceExtended>[] | undefined,
  variant: "value" | "env" = "value",
) {
  const dataRef = useRef<TVariableReferenceData<TReferenceExtended>>({ tokens: undefined });
  dataRef.current = { tokens };
  const language = useMemo(
    () =>
      variant === "env"
        ? createEnvVariablesLanguage(() => dataRef.current)
        : createVariableReferenceLanguage(() => dataRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tokens, variant],
  );

  const icons: TCachedIcon[] = useMemo(() => {
    const distinct = new Set<string>();
    for (const token of tokens ?? []) {
      if (token.brand) distinct.add(token.brand);
    }
    return [
      {
        key: loadingReferencesIconKey,
        node: <LoaderIcon className="size-4 shrink-0 animate-spin" />,
      },
      ...[...distinct].map((brand) => ({
        key: brand,
        node: <BrandIcon color="brand" brand={brand} className="size-4.5 shrink-0" />,
      })),
    ];
  }, [tokens]);

  return { language, icons };
}

const props: { referenceProps: TReferenceProps } = { referenceProps: { tokens: [] } };

export const VariablesFormField = withForm({
  defaultValues: {
    variables: variablesFormFieldDefaultVariables,
  },
  props,
  render: function Render({ form, referenceProps }) {
    const { language, icons } = useVariableReferenceLanguage(referenceProps.tokens);

    const onPaste = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const text = clipboardData.getData("text");
        const variables = getVariablesFromRawText(text);

        if (
          variables.length === 0 ||
          (variables.length === 1 && (!variables[0].name || !variables[0].value))
        ) {
          return;
        }

        e.preventDefault();

        for (let i = 0; i < variables.length; i++) {
          const variable = variables[i];
          if (
            i === 0 &&
            !form.state.values.variables[index].name &&
            !form.state.values.variables[index].value
          ) {
            form.replaceFieldValue("variables", index, variable);
            continue;
          }
          form.insertFieldValue("variables", index + i, variable);
        }
      },
      [form],
    );

    return (
      <form.AppField
        name="variables"
        mode="array"
        children={(field) => (
          <div className="flex w-full flex-col items-start gap-2">
            {!referenceProps.disabled && <IconCache icons={icons} />}
            {/* All secret rows */}
            <div className="flex w-full flex-col items-start gap-1">
              {field.state.value.map((_, i) => {
                return (
                  <div key={`secret-wrapper-${i}`} className="flex w-full flex-col gap-1 md:gap-0">
                    {i !== 0 && <div className="bg-border h-px w-full md:hidden" />}
                    <div
                      key={`secret-${i}`}
                      data-first={i === 0 || undefined}
                      className="relative flex w-full flex-col gap-2 p-3 md:flex-row md:items-start md:px-4 md:py-0.5"
                    >
                      <form.AppField key={`variables[${i}].name`} name={`variables[${i}].name`}>
                        {(subField) => {
                          return (
                            <field.TextField
                              dontCheckUntilSubmit
                              field={subField}
                              value={subField.state.value}
                              onBlur={subField.handleBlur}
                              onPaste={(e) => onPaste(e, i)}
                              onChange={(e) => {
                                subField.handleChange(e.target.value);
                              }}
                              placeholder="VARIABLE_NAME"
                              classNameInput="font-mono"
                              className="mr-12.5 flex-1 md:mr-0 md:max-w-64"
                              autoCapitalize="off"
                              autoCorrect="off"
                              autoComplete="off"
                              spellCheck="false"
                            />
                          );
                        }}
                      </form.AppField>
                      <form.AppField key={`variables[${i}].value`} name={`variables[${i}].value`}>
                        {(subField) => (
                          <VariableValueField
                            Field={field.TokenField}
                            subField={subField}
                            language={language}
                            referencesDisabled={referenceProps.disabled}
                          />
                        )}
                      </form.AppField>
                      <form.Subscribe
                        selector={(state) => ({ firstVariable: state.values.variables[0] })}
                        children={({ firstVariable }) => (
                          <Button
                            disabled={
                              field.state.value.length <= 1 &&
                              firstVariable.name === "" &&
                              firstVariable.value === ""
                            }
                            type="button"
                            variant="outline"
                            size="icon"
                            className="absolute top-3 right-3 h-10.5 w-10.5 md:relative md:top-auto md:right-auto"
                            onClick={() => {
                              if (field.state.value.length <= 1) {
                                form.resetField("variables");
                                return;
                              }
                              field.removeValue(i);
                            }}
                          >
                            <Trash2Icon className="size-5" />
                          </Button>
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="-mt-2 w-full px-3 pb-3 md:-mt-0.5 md:px-4 md:pb-0.5">
              <Button
                type="button"
                variant="outline"
                className="px-4"
                onClick={() => field.pushValue({ name: "", value: "" })}
              >
                <PlusIcon className="-ml-1.25 size-5 shrink-0" />
                <p className="min-w-0 shrink">Add Another</p>
              </Button>
            </div>
            <div className="text-muted-more-foreground -mt-2 flex w-full items-center justify-start gap-1.25 border-t px-3.25 pt-2.5 pb-2 md:mt-1.25 md:-mb-0.5 md:px-4.25 md:pt-2.5 md:pb-0">
              <InfoIcon className="inline-block size-3.5 shrink-0 sm:size-4" />
              <p className="max-w-full min-w-0 shrink text-sm leading-tight">
                You can paste multiple KEY=value pairs at once
              </p>
            </div>
          </div>
        )}
      />
    );
  },
});

type TValueFieldProps = {
  Field: FC<
    TTokenFieldProps & {
      field: AnyFieldApi;
      dontCheckUntilSubmit?: boolean;
      classNameInput?: string;
    }
  >;
  subField: AnyFieldApi;
  language: LanguageSupport;
  referencesDisabled?: boolean;
  /** Matches a 9-unit input for inline edits, growing only when the value wraps. */
  compact?: boolean;
  placeholder?: string;
};

export function VariableValueField({
  Field,
  subField,
  language,
  referencesDisabled,
  compact,
  placeholder,
}: TValueFieldProps) {
  const fieldRef = useRef<TTokenFieldHandle>(null);

  return (
    <Field
      dontCheckUntilSubmit
      ref={fieldRef}
      field={subField}
      value={subField.state.value}
      onBlur={subField.handleBlur}
      onChange={(value) => subField.handleChange(value)}
      language={referencesDisabled ? undefined : language}
      completionAdditions={referencesDisabled ? undefined : referenceCompletionAdditions}
      anchorDropdownToField
      multiline
      trailing={
        referencesDisabled ? undefined : (
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Insert reference"
            // Keeps the focus in the field: a blur closes the dropdown on a
            // delay, which would land after this reopens it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fieldRef.current?.insertAndComplete(resolveReferenceInsertion)}
            className={cn(
              "text-muted-foreground focus:ring-primary mb-auto rounded-md",
              compact ? "mt-0.75 mr-0.75 h-7 w-8" : "mt-1 mr-1 h-8 w-9",
            )}
          >
            <Link2Icon className="size-4" />
          </Button>
        )
      }
      classNameInput={compact ? "min-h-9 rounded-lg text-sm sm:rounded-md" : undefined}
      classNameEditor={cn("font-mono max-h-35 overflow-auto", compact && "px-2.5 py-1.5")}
      className="flex-1"
      placeholder={placeholder ?? (referencesDisabled ? "Value" : "Value or ${Reference}")}
    />
  );
}

export type { TReferenceExtended };
