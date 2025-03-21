import { Button } from "@/components/ui/button";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { SecretSchema, TSecret } from "@/server/trpc/api/secrets/types";
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
  console.log({ teamId, projectId, environmentId, serviceId });
  const [isOpen, setIsOpen] = useState(false);
  const variableCount = 12;
  const form = useAppForm({
    defaultValues: {
      secrets: [{ name: "", value: "" }] as TSecret[],
    },
    validators: {
      onChange: z.object({ secrets: z.array(SecretSchema) }),
    },
    onSubmit: async ({ formApi }) => {
      /* await updateProject({
        description: value.description || "",
        displayName: value.displayName,
        projectId,
        teamId,
      });
      await Promise.all([refetchProject(), refetchProjects()]) */
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
      console.log({ lines });
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
        <h2 className="min-w-0 shrink truncate px-1 text-lg leading-tight font-bold">
          {variableCount} Variables
        </h2>
        <Button
          data-open={isOpen ? true : undefined}
          data-closed={!isOpen ? true : undefined}
          className="group/button data-closed:border-primary shrink-0 gap-1 px-2.5 py-1.75 data-closed:border"
          onClick={() => setIsOpen((o) => !o)}
          variant={isOpen ? "outline" : "default"}
        >
          <PlusIcon className="-ml-1 size-5 shrink-0 transition-transform group-data-open/button:rotate-45" />
          <p>{isOpen ? "Close" : "New Variable"}</p>
        </Button>
      </div>
      {isOpen && (
        <form className="flex w-full flex-col rounded-xl border">
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
                                  field={field}
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
                          <div className="flex flex-1 gap-2">
                            <form.Field key={`value-${i}`} name={`secrets[${i}].value`}>
                              {(subField) => {
                                return (
                                  <field.TextField
                                    field={field}
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
                                  className="h-auto w-11 self-stretch"
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
          <div className="bg-background-hover flex w-full flex-row items-center justify-end rounded-b-xl border-t p-2 md:p-3">
            <Button>Save</Button>
          </div>
        </form>
      )}
    </div>
  );
}
