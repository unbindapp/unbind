import ErrorLine from "@/components/error-line";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { cn } from "@/components/ui/utils";
import { toStoredVariables } from "@/components/variables/helpers";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import {
  VariablesFormField,
  type TReferenceProps,
} from "@/components/variables/variables-form-field";
import { useVariables } from "@/components/variables/variables-provider";
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

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const referenceProps: TReferenceProps = useMemo(
    () => (tokensDisabled ? { tokens: [], disabled: true } : { tokens }),
    [tokensDisabled, tokens],
  );

  const persistenceKey = [
    "create-variables",
    typedProps.type,
    typedProps.teamId,
    typedProps.projectId,
    typedProps.environmentId,
    typedProps.serviceId,
  ]
    .filter(Boolean)
    .join(":");

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

      const variables = toStoredVariables(value.variables, tokens);
      stage(variables);

      for (const i of variables) {
        temporarilyAddNewEntity(getNewEntityIdForVariable({ name: i.name, value: i.value }));
      }

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
