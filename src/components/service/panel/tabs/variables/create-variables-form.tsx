import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useVariableReferences } from "@/components/service/panel/tabs/variables/variable-references-provider";
import { useVariables } from "@/components/service/panel/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { splitByTokens, TToken } from "@/components/ui/textarea-with-tokens";
import { cn } from "@/components/ui/utils";
import { getVariablesFromRawText } from "@/components/variables/helpers";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  TAvailableVariableReference,
  TVariableForCreate,
  TVariableReferenceForCreate,
  VariableForCreateSchema,
} from "@/server/trpc/api/variables/types";
import { FormValidateOrFn } from "@tanstack/react-form";
import { ChevronDownIcon, LinkIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

type TProps = {
  variant?: "default" | "collapsible";
  onBlur?: TCreateVariablesFormOnBlur;
  className?: string;
  afterSuccessfulSubmit?: (variables: TVariableForCreate[]) => void;
  isOpen?: boolean;
};

export const CreateVariablesFormSchema = z
  .object({
    variables: z.array(VariableForCreateSchema).min(1),
  })
  .strip();

export default function CreateVariablesForm({
  variant = "default",
  onBlur,
  afterSuccessfulSubmit,
  className,
  isOpen: isOpenProp,
}: TProps) {
  const {
    list: { refetch: refetchVariables },
    update: { mutateAsync: updateVariables, error: createError },
    teamId,
    projectId,
    environmentId,
    serviceId,
  } = useVariables();

  const {
    list: { data: variableReferencesData, error: variableReferencesError },
  } = useVariableReferences();

  const [isOpen, setIsOpen] = useState(false);

  type TReferenceExtended = TAvailableVariableReference & {
    template: string;
    key: string;
  };

  const tokens: TToken<TReferenceExtended>[] | undefined = useMemo(() => {
    if (!variableReferencesData) return undefined;
    const sourceNameMap = new Map<string, string[]>();
    const allKeys: TToken<TReferenceExtended>[] = [];
    for (const obj of variableReferencesData.variables) {
      obj.keys?.forEach((key, index) => {
        if (!sourceNameMap.has(obj.source_name)) {
          sourceNameMap.set(obj.source_name, [obj.source_kubernetes_name]);
        } else {
          const sourceNameList = sourceNameMap.get(obj.source_name);
          if (sourceNameList) {
            sourceNameMap.set(obj.source_name, [...sourceNameList, obj.source_kubernetes_name]);
          }
        }

        const sourceNameIndex = sourceNameMap
          .get(obj.source_name)
          ?.indexOf(obj.source_kubernetes_name);
        const sourceNameSuffix =
          sourceNameIndex !== undefined && sourceNameIndex >= 1 ? `(${sourceNameIndex + 1})` : "";

        let variableName = key;
        const number = index + 1;
        if (obj.type === "internal_endpoint") {
          variableName = key.replace(obj.source_kubernetes_name, `UNBIND_INTERNAL_URL`);
          if (number > 1) variableName += `_${number}`;
        } else if (obj.type === "external_endpoint") {
          variableName = `UNBIND_EXTERNAL_URL`;
          if (number > 1) variableName += `_${number}`;
        }
        allKeys.push({
          value: `\${${obj.source_name}${sourceNameSuffix}.${variableName}}`,
          Icon: ({ className }: { className?: string }) => (
            <BrandIcon color="brand" brand={obj.source_icon} className={className} />
          ),
          object: { ...obj, template: `\${${obj.source_kubernetes_name}.${key}}`, key },
        });
      });
    }
    return allKeys;
  }, [variableReferencesData]);

  const form = useAppForm({
    defaultValues: {
      variables: [{ name: "", value: "" }] as TVariableForCreate[],
    },
    validators: {
      onChange: CreateVariablesFormSchema,
      onBlur,
    },
    onSubmit: async ({ formApi, value }) => {
      if (variant === "collapsible") return;
      if (!tokens) return;

      const variablesWithTokens = value.variables.map((v) => ({
        name: v.name,
        value: splitByTokens(v.value, tokens),
      }));

      const variables: TVariableForCreate[] = variablesWithTokens
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
              };
            });

          return {
            name: v.name,
            value: v.value
              .map((i) => (i.token !== null ? i.token.object.template : i.value))
              .join(""),
            sources,
          };
        });

      await updateVariables({
        teamId,
        projectId,
        environmentId,
        serviceId,
        variables,
        variableReferences,
        type: "service",
      });
      console.log("variableReferences", variableReferences);

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
      className={cn("group/card flex w-full flex-col rounded-xl border", className)}
    >
      {variant === "collapsible" && (
        <Button
          onClick={() => setIsOpen((o) => !o)}
          variant="ghost"
          className="text-muted-foreground justify-start py-3.5 text-left font-semibold group-data-open/card:rounded-b-none"
        >
          <ChevronDownIcon className="-ml-1.25 size-5 shrink-0 -rotate-90 transition-transform group-data-open/card:rotate-0" />
          <p className="min-w-0 shrink">Environment Variables</p>
        </Button>
      )}
      {(variant !== "collapsible" || isOpen) && (
        <form
          className="flex w-full flex-col group-data-[variant=collapsible]/card:-mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.validateArrayFieldsStartingFrom("variables", 0, "submit");
            form.handleSubmit();
          }}
        >
          <form.AppField
            name="variables"
            mode="array"
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
                          className="relative flex w-full flex-col gap-2 p-3 md:-mt-7 md:flex-row md:items-start md:p-4 md:data-first:mt-0 lg:-mt-7"
                        >
                          <form.Field key={`variables[${i}].name`} name={`variables[${i}].name`}>
                            {(subField) => {
                              return (
                                <field.TextField
                                  field={subField}
                                  value={subField.state.value}
                                  onBlur={subField.handleBlur}
                                  onPaste={(e) => onPaste(e, form, i)}
                                  onChange={(e) => subField.handleChange(e.target.value)}
                                  placeholder="VARIABLE_NAME"
                                  inputClassName="font-mono"
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
                                  dontCheckUntilSubmit
                                  field={subField}
                                  value={subField.state.value}
                                  onBlur={subField.handleBlur}
                                  onChange={(e) => subField.handleChange(e.target.value)}
                                  classNameTextarea="font-mono"
                                  classNameDropdownContent="font-mono"
                                  className="flex-1"
                                  placeholder="Value or ${Reference}"
                                  tokenPrefix="${"
                                  tokenSuffix="}"
                                  tokens={tokens}
                                  tokensNoneAvailableMessage="No references available yet"
                                  tokensNoMatchingMessage="No matching references"
                                  tokensErrorMessage={variableReferencesError?.message || null}
                                  dropdownButtonText="Reference"
                                  DropdownButtonIcon={LinkIcon}
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
                            children={([firsTVariable]) => (
                              <Button
                                disabled={
                                  field.state.value.length <= 1 &&
                                  firsTVariable.name === "" &&
                                  firsTVariable.value === ""
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
                <div className="-mt-6 w-full p-3 md:-mt-8 md:p-4">
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
export type TCreateVariablesFormOnBlur = FormValidateOrFn<TCreateVariablesForm>;
