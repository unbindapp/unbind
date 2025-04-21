import ErrorLine from "@/components/error-line";
import { useVariableReferences } from "@/components/service/panel/tabs/variables/variable-references-provider";
import { useVariables } from "@/components/service/panel/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { getVariablesFromRawText } from "@/components/variables/helpers";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TVariableForCreate, VariableForCreateSchema } from "@/server/trpc/api/variables/types";
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
      const variables = value.variables;
      await updateVariables({
        teamId,
        projectId,
        environmentId,
        serviceId,
        variables,
        type: "service",
      });
      await refetchVariables();
      formApi.reset();
      afterSuccessfulSubmit?.(variables);
    },
  });

  const tokens = useMemo(() => {
    if (!variableReferencesData) return undefined;
    const allVariableObjects = [
      ...variableReferencesData.data.internal_endpoints,
      ...variableReferencesData.data.external_endpoints,
      ...variableReferencesData.data.variables,
    ];
    const allKeys: string[] = [];
    for (const obj of allVariableObjects) {
      obj.keys?.forEach((key) => {
        allKeys.push(`\${${obj.name}.${key}}`);
      });
    }
    return allKeys;
  }, [variableReferencesData]);

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
                          className="flex w-full flex-col gap-2 p-3 md:-mt-7 md:flex-row md:p-4 md:data-first:mt-0 lg:-mt-7"
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
                                  placeholder="CLIENT_KEY"
                                  inputClassName="font-mono"
                                  className="flex-1 md:max-w-64"
                                  autoCapitalize="off"
                                  autoCorrect="off"
                                  autoComplete="off"
                                  spellCheck="false"
                                />
                              );
                            }}
                          </form.Field>
                          <div className="flex flex-1 items-start gap-2">
                            <form.Field
                              key={`variables[${i}].value`}
                              name={`variables[${i}].value`}
                            >
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
                                    placeholder="abc123"
                                    tokenPrefix="${"
                                    tokenSuffix="}"
                                    tokens={tokens}
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
                                  className="h-10.5 w-10.5"
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
