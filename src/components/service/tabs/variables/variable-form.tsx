import ErrorLine from "@/components/error-line";
import { useVariables } from "@/components/service/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { SecretSchema, TSecret } from "@/server/trpc/api/secrets/types";
import { api } from "@/server/trpc/setup/client";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { z } from "zod";

type Props = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

export default function VariableForm({ teamId, projectId, environmentId, serviceId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: createSecrets, error } = api.secrets.create.useMutation();
  const { data, isPending, refetch } = useVariables();

  const form = useAppForm({
    defaultValues: {
      secrets: [{ name: "", value: "" }] as TSecret[],
    },
    validators: {
      onChange: z.object({ secrets: z.array(SecretSchema) }),
    },
    onSubmit: async ({ formApi, value }) => {
      const secrets = value.secrets;
      await createSecrets({
        teamId,
        projectId,
        environmentId,
        serviceId,
        isBuildSecret: false,
        type: "service",
        secrets,
      });
      await refetch();
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
      if (lines.length === 1) return;

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
        .filter(Boolean) as TSecret[];

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (
          i === 0 &&
          !form.state.values.secrets[index].name &&
          !form.state.values.secrets[index].value
        ) {
          form.replaceFieldValue("secrets", index, pair);
          continue;
        }
        form.insertFieldValue("secrets", index + i, pair);
      }
    },
    [],
  );

  return (
    <div className="flex w-full flex-col gap-2 pb-2">
      <div className="flex w-full items-center justify-between gap-2">
        <h2
          data-pending={isPending ? true : undefined}
          className="data-pending:bg-foreground data-pending:animate-skeleton min-w-0 shrink truncate px-1 text-lg leading-tight font-bold data-pending:rounded-md data-pending:text-transparent"
        >
          {isPending || !data
            ? "Loading..."
            : `${data.secrets.length} Variable${data.secrets.length > 1 ? "s" : ""}`}
        </h2>
        <Button
          data-open={isOpen ? true : undefined}
          data-closed={!isOpen ? true : undefined}
          className="group/button shrink-0 gap-1 px-3 py-2"
          onClick={() => setIsOpen((o) => !o)}
          variant="outline"
        >
          <PlusIcon className="-ml-1 size-5 shrink-0 transition-transform group-data-open/button:rotate-45" />
          <p>{isOpen ? "Close" : "New Variable"}</p>
        </Button>
      </div>
      {isOpen && (
        <form
          className="flex w-full flex-col rounded-xl border"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.AppField
            name="secrets"
            mode="array"
            children={(field) => (
              <div className="flex w-full flex-col items-start gap-2">
                {/* All secret rows */}
                <div className="flex w-full flex-col items-start gap-1">
                  {field.state.value.map((_, i) => {
                    return (
                      <div
                        key={`secret-wrapper-${i}`}
                        className="flex w-full flex-col gap-1 sm:gap-0"
                      >
                        {i !== 0 && <div className="bg-border h-px w-full sm:hidden" />}
                        <div
                          key={`secret-${i}`}
                          data-first={i === 0 ? true : undefined}
                          className="flex w-full flex-col gap-2 p-3 sm:-mt-5 sm:flex-row sm:data-first:mt-0 md:-mt-7 md:p-4"
                        >
                          <form.Field key={`name-${i}`} name={`secrets[${i}].name`}>
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
                            <form.Field key={`value-${i}`} name={`secrets[${i}].value`}>
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
                              selector={(state) => [state.values.secrets[0]]}
                              children={([firstSecret]) => (
                                <Button
                                  disabled={
                                    field.state.value.length <= 1 &&
                                    firstSecret.name === "" &&
                                    firstSecret.value === ""
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
            {error && <ErrorLine message={error.message} />}
            <div className="flex w-full flex-row items-center justify-end">
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <form.SubmitButton disabled={!canSubmit} isPending={isSubmitting}>
                    Save
                  </form.SubmitButton>
                )}
              />
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
