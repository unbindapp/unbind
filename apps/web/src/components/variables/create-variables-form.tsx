import ErrorLine from "@/components/error-line";
import { cn } from "@/components/ui/utils";
import { toStoredVariables } from "@/components/variables/helpers";
import type { TEntityVariableTypeProps } from "@/components/variables/types";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import {
  VariablesFormField,
  type TReferenceProps,
} from "@/components/variables/variables-form-field";
import { useVariables } from "@/components/variables/variables-provider";
import { readDraft, writeDraft } from "@/lib/form-draft-storage";
import { useAppFormWithPersistence } from "@/lib/hooks/use-app-form-with-persistence";
import { TVariableForCreate, VariableForCreateSchema } from "@/lib/queries/variables";
import { useMemo } from "react";
import { toast } from "@/components/ui/toast";
import { z } from "zod";

type TProps = {
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

const CreateVariablesDraftSchema = z.object({
  variables: z.array(z.object({ name: z.string(), value: z.string() })),
});

type TCreateVariablesScope = Pick<
  TEntityVariableTypeProps,
  "type" | "teamId" | "projectId" | "environmentId" | "serviceId"
>;

// Fills the form for a scope that is not on screen yet, through the draft it already
// persists, so the user lands on an open form and can edit the name before staging it.
// A draft they were in the middle of writing is kept, the new row goes after it.
export function prefillCreateVariablesForm(
  scope: TCreateVariablesScope,
  variable: TVariableForCreate,
) {
  const key = getCreateVariablesPersistenceKey(scope);
  const draft = readDraft({ type: "session", key, schema: CreateVariablesDraftSchema });
  const written = (draft?.variables ?? []).filter((v) => v.name !== "" || v.value !== "");
  writeDraft({ type: "session", key }, { variables: [...written, variable] });
  writeDraft({ type: "session", key: `${key}:open` }, true);
}

export function getCreateVariablesPersistenceKey({
  type,
  teamId,
  projectId,
  environmentId,
  serviceId,
}: TCreateVariablesScope) {
  return ["create-variables", type, teamId, projectId, environmentId, serviceId]
    .filter(Boolean)
    .join(":");
}

export default function CreateVariablesForm({
  afterSuccessfulSubmit,
  className,
  tokensDisabled,
  isOpen: isOpenProp,
}: TProps) {
  const { stage, ...typedProps } = useVariables();

  const {
    tokens,
    list: { error: variableReferencesError },
  } = useVariableReferences();

  const referenceProps: TReferenceProps = useMemo(
    () => (tokensDisabled ? { tokens: [], disabled: true } : { tokens }),
    [tokensDisabled, tokens],
  );

  const persistenceKey = getCreateVariablesPersistenceKey(typedProps);

  const form = useAppFormWithPersistence({
    defaultValues: {
      variables: [{ name: "", value: "" }] as TVariableForCreate[],
    },
    validators: {
      onChange: CreateVariablesFormSchema,
    },
    persistenceType: "session",
    persistenceKey,
    persistenceSchema: CreateVariablesDraftSchema,
    onSubmit: async ({ formApi, value }) => {
      if (!tokens) {
        toast.add({
          type: "warning",
          title: "Variable references unavailable",
          description: "Variable references are not available yet, please try again later.",
        });
        return;
      }

      const variables = toStoredVariables(value.variables, tokens, typedProps.serviceId);
      stage(variables);

      formApi.reset();
      afterSuccessfulSubmit?.(variables);
    },
  });

  if (isOpenProp === false) {
    return null;
  }

  return (
    <div className={cn("group/card flex w-full flex-col rounded-xl border", className)}>
      <form
        className="relative flex w-full flex-col md:pt-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.validateArrayFieldsStartingFrom("variables", 0, "submit");
          form.handleSubmit(e);
        }}
      >
        <VariablesFormField form={form} referenceProps={referenceProps} />
        <div className="bg-card flex w-full flex-col gap-3 rounded-b-xl border-t p-2 md:mt-3.5 md:p-2.5">
          {variableReferencesError && <ErrorLine message={variableReferencesError.message} />}
          <div className="flex w-full flex-row items-center justify-end">
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={({ isSubmitting }) => (
                <form.SubmitButton isPending={isSubmitting}>Add</form.SubmitButton>
              )}
            />
          </div>
        </div>
      </form>
    </div>
  );
}

export type TCreateVariablesForm = z.infer<typeof CreateVariablesFormSchema>;
