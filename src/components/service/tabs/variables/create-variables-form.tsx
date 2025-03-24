import ErrorLine from "@/components/error-line";
import { useVariables } from "@/components/service/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { VariableSchema, TVariable } from "@/server/trpc/api/variables/types";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";

export default function CreateVariablesForm() {
  const {
    list: { refetch: refetchSecrets },
    create: { mutateAsync: createSecrets, error: createError },
    teamId,
    projectId,
    environmentId,
    serviceId,
  } = useVariables();

  const form = useAppForm({
    defaultValues: {
      variables: [{ name: "", value: "" }] as TVariable[],
    },
    validators: {
      onChange: z.object({ variables: z.array(VariableSchema).min(1) }),
    },
    onSubmit: async ({ formApi, value }) => {
      const variables = value.variables;
      await createSecrets({
        teamId,
        projectId,
        environmentId,
        serviceId,
        variables,
        type: "service",
      });
      await refetchSecrets();
      formApi.reset();
    },
  });

  type TForm = typeof form;

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, form: TForm, index: number) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;
      const text = clipboardData.getData("text");
      if (!text) return;
      const lines = text.trim().split("\n");
      const firstLine = lines[0];
      if (!firstLine.includes("=")) return;

      e.preventDefault();
      const pairs = lines
        .map((line) => {
          const [name, value] = line.split("=");
          if (!name || !value) {
            return undefined;
          }
          const validatedName = name.trim();
          const validatedValue = value.trim();
          return { name: validatedName, value: validatedValue };
        })
        .filter(Boolean) as TVariable[];

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (
          i === 0 &&
          !form.state.values.variables[index].name &&
          !form.state.values.variables[index].value
        ) {
          form.replaceFieldValue("variables", index, pair);
          continue;
        }
        form.insertFieldValue("variables", index + i, pair);
      }
    },
    [],
  );

  return (
    <form
      className="flex w-full flex-col rounded-xl border"
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
                  <div key={`secret-wrapper-${i}`} className="flex w-full flex-col gap-1 sm:gap-0">
                    {i !== 0 && <div className="bg-border h-px w-full sm:hidden" />}
                    <div
                      key={`secret-${i}`}
                      data-first={i === 0 ? true : undefined}
                      className="flex w-full flex-col gap-2 p-3 sm:-mt-5 sm:flex-row sm:data-first:mt-0 md:-mt-7 md:p-4"
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
                              className="flex-1 sm:max-w-64"
                            />
                          );
                        }}
                      </form.Field>
                      <div className="flex flex-1 items-start gap-2">
                        <form.Field key={`variables[${i}].value`} name={`variables[${i}].value`}>
                          {(subField) => {
                            return (
                              <field.TextField
                                field={subField}
                                value={subField.state.value}
                                onBlur={subField.handleBlur}
                                onPaste={(e) => onPaste(e, form, i)}
                                onChange={(e) => subField.handleChange(e.target.value)}
                                className="flex-1"
                                placeholder="abc123"
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
                              className="h-11 w-11"
                              onClick={() => {
                                if (field.state.value.length <= 1) {
                                  field.replaceValue(0, { name: "", value: "" });
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
                onClick={() => field.pushValue({ name: "", value: "" })}
              >
                <PlusIcon className="-ml-1.5 size-5 shrink-0" />
                <p className="min-w-0 shrink">Add Another</p>
              </Button>
            </div>
          </div>
        )}
      />
      <div className="bg-background-hover flex w-full flex-col gap-3 rounded-b-xl border-t p-2 md:p-3">
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
    </form>
  );
}
