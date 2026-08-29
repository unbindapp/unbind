import ErrorLine from "@/components/error-line";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { cn } from "@/components/ui/utils";
import { getVariablesPair } from "@/components/variables/helpers";
import {
  buildReferenceTokens,
  type TReferenceExtended,
  type TVariableToken,
} from "@/components/variables/tokens";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import {
  VariablesFormField,
  type TReferenceProps,
} from "@/components/variables/variables-form-field";
import { useVariables } from "@/components/variables/variables-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  TVariableForCreate,
  VariableForCreateSchema,
  VariableReferenceForCreateSchema,
} from "@/lib/queries/variables";
import { ResultAsync } from "neverthrow";
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

export default function CreateVariablesForm({
  afterSuccessfulSubmit,
  className,
  tokensDisabled,
  isOpen: isOpenProp,
}: TProps) {
  const {
    list: { refetch: refetchVariables },
    createOrUpdate: { mutateAsync: createOrUpdateVariables, error: createOrUpdateVariablesError },
    ...typedProps
  } = useVariables();

  const {
    list: { data: variableReferencesData, error: variableReferencesError },
  } = useVariableReferences();

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const tokens: TVariableToken<TReferenceExtended>[] | undefined = useMemo(() => {
    if (!variableReferencesData) return undefined;
    return buildReferenceTokens(variableReferencesData.variables);
  }, [variableReferencesData]);

  const referenceProps: TReferenceProps = useMemo(
    () => (tokensDisabled ? { tokens: [], disabled: true } : { tokens }),
    [tokensDisabled, tokens],
  );

  const form = useAppForm({
    defaultValues: {
      variables: [{ name: "", value: "" }] as TVariableForCreate[],
    },
    validators: {
      onChange: CreateVariablesFormSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      if (!tokens) {
        toast.add({
          type: "warning",
          title: "Variable references unavailable",
          description: "Variable references are not available yet, please try again later.",
        });
        return;
      }

      const { variables, variableReferences } = getVariablesPair({
        variables: value.variables,
        tokens,
      });

      await createOrUpdateVariables({
        ...typedProps,
        variables,
        variableReferences,
      });

      const result = await ResultAsync.fromPromise(
        refetchVariables(),
        () => new Error("Failed to refetch variables"),
      );

      if (result.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to refetch",
          description: "Failed to refetch variables after creation, please refresh the page.",
        });
      }

      for (const i of value.variables) {
        const id = getNewEntityIdForVariable({ name: i.name, value: i.value });
        temporarilyAddNewEntity(id);
      }
      for (const i of variableReferences) {
        const id = getNewEntityIdForVariable({ name: i.name, value: i.value });
        temporarilyAddNewEntity(id);
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
          {createOrUpdateVariablesError && (
            <ErrorLine message={createOrUpdateVariablesError.message} />
          )}
          {variableReferencesError && <ErrorLine message={variableReferencesError.message} />}
          <div className="flex w-full flex-row items-center justify-end">
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={({ isSubmitting }) => (
                <form.SubmitButton isPending={isSubmitting}>Save</form.SubmitButton>
              )}
            />
          </div>
        </div>
      </form>
    </div>
  );
}

export type TCreateVariablesForm = z.infer<typeof CreateVariablesFormSchema>;

export const CreateVariablesFormResultSchema = z.object({
  variables: VariableForCreateSchema.array(),
  variableReferences: VariableReferenceForCreateSchema.array(),
});
export type TCreateVariablesFormResult = z.infer<typeof CreateVariablesFormResultSchema>;
export type TCreateVariablesFormOnBlur = (props: TCreateVariablesFormResult) => void;
