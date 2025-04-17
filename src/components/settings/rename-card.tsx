import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { LoaderIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { ZodObject, ZodString, ZodTypeAny } from "zod";

type TRenameCardType = "team" | "project";

type TProps = {
  type: TRenameCardType;
  displayName: string | undefined;
  description: string | null | undefined;
  displayNameMaxLength: number;
  descriptionMaxLength: number;
  onSubmit: (value: { displayName: string; description: string }) => Promise<void>;
  schema: TFormSchema;
  error: {
    message: string;
  } | null;
  className?: string;
};

type TFormValues = {
  displayName: string;
  description: string;
};

type TFormSchema = ZodObject<
  {
    displayName: ZodString;
    description: ZodString;
  },
  "strip",
  ZodTypeAny,
  TFormValues,
  TFormValues
>;

export default function RenameCard({
  type,
  displayName,
  description,
  displayNameMaxLength,
  descriptionMaxLength,
  onSubmit,
  schema,
  error,
  className,
}: TProps) {
  const form = useAppForm({
    defaultValues: {
      displayName: displayName || "",
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

  const { displayName: displayNameTitle, description: descriptionTitle } = getInputTitles(type);

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex w-full flex-col gap-3 xl:flex-row xl:items-start"
      >
        <form.AppField
          name="displayName"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle={displayNameTitle}
              className="flex-1 xl:max-w-72"
              maxLength={displayNameMaxLength}
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
          selector={(state) => [state.isSubmitting, state.values]}
          children={([isSubmitting, values]) => {
            const valuesUnchanged =
              typeof values === "object" &&
              values.displayName === displayName &&
              looseMatch(values.description, description);
            return (
              <div className="flex w-full flex-row gap-3 md:w-auto">
                <form.SubmitButton
                  data-submitting={isSubmitting ? true : undefined}
                  className="group/button flex-1 md:flex-none xl:py-3.75"
                  disabled={valuesUnchanged}
                >
                  <div className="-ml-1 size-5 shrink-0">
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
                  className="gap-1.5 xl:py-3.75"
                >
                  <RotateCcwIcon
                    data-rotated={valuesUnchanged ? true : undefined}
                    className="-ml-1 size-5 shrink-0 transition-transform data-rotated:-rotate-135"
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
        displayName: "Team Name",
        description: "Team Description",
      };
    case "project":
      return {
        displayName: "Project Name",
        description: "Project Description",
      };
    default:
      return {
        displayName: "Name",
        description: "Description",
      };
  }
}

function looseMatch(a: string | null | undefined, b: string | null | undefined) {
  const _a = a || "";
  const _b = b || "";
  return _a === _b;
}
