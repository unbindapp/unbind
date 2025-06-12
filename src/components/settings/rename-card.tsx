import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { LoaderIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { ZodObject, ZodString, ZodTypeAny } from "zod";

type TRenameCardType = "team" | "project";

type TProps = {
  type: TRenameCardType;
  name: string | undefined;
  description: string | null | undefined;
  nameMaxLength: number;
  descriptionMaxLength: number;
  onSubmit: (value: { name: string; description: string }) => Promise<void>;
  schema: TFormSchema;
  error: {
    message: string;
  } | null;
  className?: string;
};

type TFormValues = {
  name: string;
  description: string;
};

type TFormSchema = ZodObject<
  {
    name: ZodString;
    description: ZodString;
  },
  "strip",
  ZodTypeAny,
  TFormValues,
  TFormValues
>;

export default function RenameCard({
  type,
  name,
  description,
  nameMaxLength,
  descriptionMaxLength,
  onSubmit,
  schema,
  error,
  className,
}: TProps) {
  const form = useAppForm({
    defaultValues: {
      name: name || "",
      description: description || "",
    },
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ formApi, value }) => {
      await onSubmit(value);
      formApi.reset();
    },
  });

  const { name: nameTitle, description: descriptionTitle } = getInputTitles(type);

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(e);
        }}
        className="flex w-full flex-col gap-3 xl:flex-row xl:items-start"
      >
        <form.AppField
          name="name"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle={nameTitle}
              className="flex-1 xl:max-w-72"
              maxLength={nameMaxLength}
            />
          )}
        />
        <form.AppField
          name="description"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle={descriptionTitle}
              className="flex-1"
              maxLength={descriptionMaxLength}
            />
          )}
        />
        <form.Subscribe
          selector={(state) => ({ isSubmitting: state.isSubmitting, values: state.values })}
          children={({ isSubmitting, values }) => {
            const valuesUnchanged =
              values.name === name && looseMatch(values.description, description);
            return (
              <div className="flex w-full flex-row gap-3 md:w-auto">
                <form.SubmitButton
                  data-submitting={isSubmitting ? true : undefined}
                  className="group/button flex-1 md:flex-none xl:py-3.5"
                  disabled={valuesUnchanged}
                >
                  <div className="-ml-0.5 size-4.5 shrink-0">
                    {isSubmitting ? (
                      <LoaderIcon className="size-full animate-spin" />
                    ) : (
                      <SaveIcon className="size-full" />
                    )}
                  </div>
                  <p className="min-w-0 shrink">Save</p>
                </form.SubmitButton>
                <Button
                  disabled={valuesUnchanged}
                  onClick={() => form.reset()}
                  variant="outline"
                  className="gap-1.5 xl:py-3.5"
                >
                  <RotateCcwIcon
                    data-unchanged={valuesUnchanged ? true : undefined}
                    className="-ml-0.5 size-4.5 shrink-0 transition-transform data-unchanged:-rotate-90"
                  />
                  <p className="min-w-0">Undo</p>
                </Button>
              </div>
            );
          }}
        />
      </form>
      {error && <ErrorLine message={error.message} />}
    </div>
  );
}

function getInputTitles(type: TRenameCardType) {
  switch (type) {
    case "team":
      return {
        name: "Team Name",
        description: "Team Description",
      };
    case "project":
      return {
        name: "Project Name",
        description: "Project Description",
      };
    default:
      return {
        name: "Name",
        description: "Description",
      };
  }
}

function looseMatch(a: string | null | undefined, b: string | null | undefined) {
  const _a = a || "";
  const _b = b || "";
  return _a === _b;
}
