import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { Button } from "@/components/ui/button";
import { splitByTokens, TToken } from "@/components/ui/textarea-with-tokens";
import { cn } from "@/components/ui/utils";
import {
  getReferenceVariableReadableNames,
  getVariablesFromRawText,
} from "@/components/variables/helpers";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import { useVariables } from "@/components/variables/variables-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  TAvailableVariableReference,
  TVariableForCreate,
  TVariableReferenceForCreate,
  VariableForCreateSchema,
  VariableReferenceForCreateSchema,
} from "@/server/trpc/api/variables/types";
import { ChevronDownIcon, Link2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

type TProps = {
  variant?: "default" | "collapsible";
  onValueChange?: TCreateVariablesFormOnBlur;
  className?: string;
  afterSuccessfulSubmit?: (variables: TVariableForCreate[]) => void;
  isOpen?: boolean;
  tokensDisabled?: boolean;
};

export const CreateVariablesFormSchema = z
  .object({
    variables: z.array(VariableForCreateSchema).min(1),
  })
  .strip();

type TReferenceExtended = TAvailableVariableReference & {
  template: string;
  key: string;
};

export default function CreateVariablesForm({
  variant = "default",
  afterSuccessfulSubmit,
  className,
  tokensDisabled,
  onValueChange,
  isOpen: isOpenProp,
}: TProps) {
  const {
    list: { refetch: refetchVariables },
    createOrUpdate: { mutateAsync: createOrUpdateVariables, error: createError },
    ...typedProps
  } = useVariables();

  const {
    list: { data: variableReferencesData, error: variableReferencesError },
  } = useVariableReferences();

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const [isOpen, setIsOpen] = useState(false);

  const tokens: TToken<TReferenceExtended>[] | undefined = useMemo(() => {
    if (!variableReferencesData) return undefined;
    const sourceNameMap = new Map<string, string[]>();
    const allKeys: TToken<TReferenceExtended>[] = [];
    for (const obj of variableReferencesData.variables) {
      obj.keys?.forEach((key, index) => {
        const { sourceName: _sourceName, readableKey: _readableKey } =
          getReferenceVariableReadableNames({
            key,
            object: obj,
          });
        const sourceName = _sourceName;
        let readableKey = _readableKey;

        const number = index + 1;

        if (!sourceNameMap.has(sourceName)) {
          sourceNameMap.set(sourceName, [obj.source_kubernetes_name]);
        } else {
          const sourceNameList = sourceNameMap.get(sourceName);
          if (sourceNameList) {
            sourceNameMap.set(sourceName, [...sourceNameList, obj.source_kubernetes_name]);
          }
        }

        const sourceNameIndex = sourceNameMap
          .get(obj.source_name)
          ?.indexOf(obj.source_kubernetes_name);

        const sourceNameSuffix =
          sourceNameIndex !== undefined && sourceNameIndex >= 1 ? `(${sourceNameIndex + 1})` : "";

        if (obj.type === "internal_endpoint") {
          if (number > 1) readableKey += `_${number}`;
        } else if (obj.type === "external_endpoint") {
          if (number > 1) readableKey += `_${number}`;
        }

        allKeys.push({
          value: `\${${sourceName}${sourceNameSuffix}.${readableKey}}`,
          Icon: ({ className }: { className?: string }) => (
            <BrandIcon color="brand" brand={obj.source_icon} className={className} />
          ),
          object: { ...obj, template: `\${${obj.source_kubernetes_name}.${key}}`, key },
        });
      });
    }
    return allKeys;
  }, [variableReferencesData]);

  const tokenProps = useMemo(() => {
    if (tokensDisabled) return { tokensDisabled: true } as const;
    return {
      tokenPrefix: "${",
      tokenSuffix: "}",
      tokens: tokens,
      tokensNoneAvailableMessage: "No references available yet",
      tokensNoMatchingMessage: "No matching references",
      tokensErrorMessage: variableReferencesError?.message || null,
      dropdownButtonText: "Reference",
      DropdownButtonIcon: Link2Icon,
    };
  }, [tokensDisabled, tokens, variableReferencesError]);

  const form = useAppForm({
    defaultValues: {
      variables: [{ name: "", value: "" }] as TVariableForCreate[],
    },
    validators: {
      onChange: CreateVariablesFormSchema,
    },
    listeners: {
      onChange: ({ formApi }) => {
        if (!onValueChange) return;
        const { variables, variableReferences } = getVariablesPair({
          variables: formApi.state.values.variables,
          tokens: tokens || [],
        });
        onValueChange({
          variables,
          variableReferences,
        });
      },
    },
    onSubmit: async ({ formApi, value }) => {
      if (variant === "collapsible") return;
      if (!tokens) return;

      const { variables, variableReferences } = getVariablesPair({
        variables: value.variables,
        tokens,
      });

      await createOrUpdateVariables({
        ...typedProps,
        variables,
        variableReferences,
      });

      for (const i of value.variables) {
        const id = getNewEntityIdForVariable({ name: i.name, value: i.value });
        temporarilyAddNewEntity(id);
      }
      for (const i of variableReferences) {
        const id = getNewEntityIdForVariable({ name: i.name, value: i.value });
        temporarilyAddNewEntity(id);
      }

      await refetchVariables();

      formApi.reset();
      afterSuccessfulSubmit?.(variables);
    },
  });

  type TForm = typeof form;

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, form: TForm, index: number) => {
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
    [],
  );

  if (isOpenProp === false) {
    return null;
  }

  return (
    <div
      data-open={variant !== "collapsible" || isOpen ? true : undefined}
      data-variant={variant}
      className={cn(
        "group/card flex w-full flex-col rounded-xl border data-[variant=collapsible]:rounded-lg",
        className,
      )}
    >
      {variant === "collapsible" && (
        <Button
          onClick={() => setIsOpen((o) => !o)}
          variant="ghost"
          className="text-muted-foreground group-data-open/card:text-foreground z-10 justify-start gap-1 px-3 text-left font-semibold group-data-[variant=collapsible]/card:rounded-md group-data-[variant=collapsible]/card:group-data-open/card:rounded-b-none"
        >
          <ChevronDownIcon className="-ml-0.75 size-5 shrink-0 -rotate-90 transition-transform group-data-open/card:rotate-0" />
          <p className="min-w-0 shrink">Environment Variables</p>
        </Button>
      )}
      {(variant !== "collapsible" || isOpen) && (
        <form
          className="relative flex w-full flex-col group-data-[variant=collapsible]/card:-mt-2 md:pt-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.validateArrayFieldsStartingFrom("variables", 0, "submit");
            form.handleSubmit();
          }}
        >
          <form.AppField
            name="variables"
            mode="value"
            children={(field) => (
              <div className="flex w-full flex-col items-start gap-2">
                {/* All secret rows */}
                <div className="flex w-full flex-col items-start gap-1">
                  {field.state.value.map((_, i) => {
                    return (
                      <div
                        key={`secret-wrapper-${i}`}
                        className="flex w-full flex-col gap-1 md:gap-0"
                      >
                        {i !== 0 && <div className="bg-border h-px w-full md:hidden" />}
                        <div
                          key={`secret-${i}`}
                          data-first={i === 0 ? true : undefined}
                          className="relative flex w-full flex-col gap-2 p-3 md:flex-row md:items-start md:px-4 md:py-0.5"
                        >
                          <form.Field key={`variables[${i}].name`} name={`variables[${i}].name`}>
                            {(subField) => {
                              return (
                                <field.TextField
                                  field={subField}
                                  value={subField.state.value}
                                  onBlur={subField.handleBlur}
                                  onPaste={(e) => onPaste(e, form, i)}
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
                          </form.Field>
                          <form.Field key={`variables[${i}].value`} name={`variables[${i}].value`}>
                            {(subField) => {
                              return (
                                <field.TextareaWithTokens
                                  {...tokenProps}
                                  dontCheckUntilSubmit
                                  field={subField}
                                  value={subField.state.value}
                                  onBlur={subField.handleBlur}
                                  onChange={(e) => subField.handleChange(e.target.value)}
                                  classNameTextarea="font-mono"
                                  classNameDropdownContent="font-mono"
                                  className="flex-1"
                                  placeholder={tokensDisabled ? "Value" : "Value or ${Reference}"}
                                  autoCapitalize="off"
                                  autoCorrect="off"
                                  autoComplete="off"
                                  spellCheck="false"
                                />
                              );
                            }}
                          </form.Field>
                          <form.Subscribe
                            selector={(state) => [state.values.variables[0]]}
                            children={([firstVariable]) => (
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
                                    form.reset();
                                    return;
                                  }
                                  field.removeValue(i);
                                }}
                              >
                                <TrashIcon className="size-5" />
                              </Button>
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="-mt-2 w-full p-3 pt-0 md:-mt-0.5 md:p-4 md:pt-0">
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
              </div>
            )}
          />
          {variant !== "collapsible" && (
            <div className="bg-background-hover flex w-full flex-col gap-3 rounded-b-xl border-t p-2 md:p-2.5">
              {createError && <ErrorLine message={createError.message} />}
              <div className="flex w-full flex-row items-center justify-end">
                <form.Subscribe
                  selector={(state) => [state.isSubmitting]}
                  children={([isSubmitting]) => (
                    <form.SubmitButton isPending={isSubmitting}>Save</form.SubmitButton>
                  )}
                />
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export type TCreateVariablesForm = z.infer<typeof CreateVariablesFormSchema>;

export const CreateVariablesFormResultSchema = z.object({
  variables: VariableForCreateSchema.array(),
  variableReferences: VariableReferenceForCreateSchema.array(),
});
export type TCreateVariablesFormResult = z.infer<typeof CreateVariablesFormResultSchema>;
export type TCreateVariablesFormOnBlur = (props: TCreateVariablesFormResult) => void;

function getVariablesPair({
  variables,
  tokens,
}: {
  variables: TVariableForCreate[];
  tokens: TToken<TReferenceExtended>[];
}) {
  const variablesWithTokens = variables.map((v) => ({
    name: v.name,
    value: splitByTokens(v.value, tokens),
  }));

  const variablesRegular: TVariableForCreate[] = variablesWithTokens
    .filter((v) => v.value.every((v) => v.token === null))
    .map((v) => ({ name: v.name, value: v.value.map((i) => i.value).join("") }));

  const variableReferences: TVariableReferenceForCreate[] = variablesWithTokens
    .filter((v) => v.value.some((v) => v.token !== null))
    .map((v) => {
      // TODO: Filter to only unique sources
      const sources: TVariableReferenceForCreate["sources"] = v.value
        .filter((i) => i.token !== null)
        .map((i) => {
          const t = i.token!;
          return {
            key: t.object.key,
            type: t.object.type,
            source_id: t.object.source_id,
            source_kubernetes_name: t.object.source_kubernetes_name,
            source_type: t.object.source_type,
            source_name: t.object.source_name,
            source_icon: t.object.source_icon,
          };
        });

      return {
        name: v.name,
        value: v.value.map((i) => (i.token !== null ? i.token.object.template : i.value)).join(""),
        sources,
      };
    });
  return {
    variables: variablesRegular,
    variableReferences,
  };
}
