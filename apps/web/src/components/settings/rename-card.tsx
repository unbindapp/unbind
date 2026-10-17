import {
  Block,
  BlockItem,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import ErrorLine from "@/components/error-line";
import SettingsCard, { SettingsCardFooterRow } from "@/components/settings/settings-card";
import { cn } from "@/components/ui/utils";
import { getTakenNameError, TUniqueAmong } from "@/lib/helpers/unique-name";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { IdCardIcon, LoaderIcon, SaveIcon } from "lucide-react";
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
  uniqueAmong?: TUniqueAmong;
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
  uniqueAmong,
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
      const saved = schema.parse(value);
      await onSubmit(saved);
      formApi.reset(saved);
    },
  });

  const copy = getCopy(type);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit(e);
      }}
      className={cn("w-full", className)}
    >
      <SettingsCard
        title={copy.card}
        Icon={IdCardIcon}
        footer={
          <>
            {error && <ErrorLine message={error.message} />}
            <SettingsCardFooterRow>
              <form.Subscribe
                selector={(state) => ({ isSubmitting: state.isSubmitting, values: state.values })}
                children={({ isSubmitting, values }) => {
                  const valuesUnchanged =
                    values.name === name && looseMatch(values.description, description);
                  return (
                    <form.SubmitButton
                      data-submitting={isSubmitting || undefined}
                      className="group/button"
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
                  );
                }}
              />
            </SettingsCardFooterRow>
          </>
        }
      >
        <Block>
          <BlockItem>
            <BlockItemHeader type="column">
              <BlockItemTitle>{copy.name}</BlockItemTitle>
              <BlockItemDescription>{copy.nameDescription}</BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <form.AppField
                name="name"
                validators={{
                  onChange: ({ value }) => getTakenNameError(value, uniqueAmong, name),
                }}
                children={(field) => (
                  <field.TextField
                    field={field}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={copy.namePlaceholder}
                    maxLength={nameMaxLength}
                    revertTo={name ?? ""}
                    onRevert={() => field.setValue(name ?? "")}
                  />
                )}
              />
            </BlockItemContent>
          </BlockItem>
          <BlockItem>
            <BlockItemHeader type="column">
              <BlockItemTitle>{copy.description}</BlockItemTitle>
              <BlockItemDescription>{copy.descriptionDescription}</BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <form.AppField
                name="description"
                children={(field) => (
                  <field.TextField
                    field={field}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Optional"
                    maxLength={descriptionMaxLength}
                    revertTo={description ?? ""}
                    onRevert={() => field.setValue(description ?? "")}
                  />
                )}
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
      </SettingsCard>
    </form>
  );
}

function getCopy(type: TRenameCardType) {
  if (type === "project") {
    return {
      card: "Project Details",
      name: "Project Name",
      nameDescription: "Shown in the breadcrumb.",
      namePlaceholder: "my-project",
      description: "Project Description",
      descriptionDescription: "A short note on what the project is for.",
    };
  }
  return {
    card: "Team Details",
    name: "Team Name",
    nameDescription: "Shown in the team switcher.",
    namePlaceholder: "My Team",
    description: "Team Description",
    descriptionDescription: "A short note on what the team is for.",
  };
}

function looseMatch(a: string | null | undefined, b: string | null | undefined) {
  const _a = a || "";
  const _b = b || "";
  return _a === _b;
}
