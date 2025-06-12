import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { TToken, TTokenProps } from "@/components/ui/textarea-with-tokens";
import { cn } from "@/components/ui/utils";
import {
  getReferenceVariableReadableNames,
  getVariablesPair,
} from "@/components/variables/helpers";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import { VariablesFormField } from "@/components/variables/variables-form-field";
import { useVariables } from "@/components/variables/variables-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  TAvailableVariableReference,
  TVariableForCreate,
  VariableForCreateSchema,
  VariableReferenceForCreateSchema,
} from "@/server/trpc/api/variables/types";
import { Link2Icon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";
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

type TReferenceExtended = TAvailableVariableReference & {
  template: string;
  key: string;
};

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

  const tokens: TToken<TReferenceExtended>[] | undefined = useMemo(() => {
    if (!variableReferencesData) return undefined;
    const sourceNameMap = new Map<string, string[]>();
    const allKeys: TToken<TReferenceExtended>[] = [];
    for (const obj of variableReferencesData.variables) {
      obj.keys?.forEach((key, index) => {
        const { sourceName: _sourceName, readableKey: _readableKey } =
          getReferenceVariableReadableNames({
            key,
            object: obj,
          });
        const sourceName = _sourceName;
        let readableKey = _readableKey;

        const number = index + 1;

        if (!sourceNameMap.has(sourceName)) {
          sourceNameMap.set(sourceName, [obj.source_kubernetes_name]);
        } else {
          const sourceNameList = sourceNameMap.get(sourceName);
          if (sourceNameList) {
            sourceNameMap.set(sourceName, [...sourceNameList, obj.source_kubernetes_name]);
          }
        }

        const sourceNameIndex = sourceNameMap
          .get(obj.source_name)
          ?.indexOf(obj.source_kubernetes_name);

        const sourceNameSuffix =
          sourceNameIndex !== undefined && sourceNameIndex >= 1 ? `(${sourceNameIndex + 1})` : "";

        if (obj.type === "internal_endpoint") {
          if (number > 1) readableKey += `_${number}`;
        } else if (obj.type === "external_endpoint") {
          if (number > 1) readableKey += `_${number}`;
        }

        allKeys.push({
          value: `\${${sourceName}${sourceNameSuffix}.${readableKey}}`,
          Icon: ({ className }: { className?: string }) => (
            <BrandIcon color="brand" brand={obj.source_icon} className={className} />
          ),
          object: { ...obj, template: `\${${obj.source_kubernetes_name}.${key}}`, key },
        });
      });
    }
    return allKeys;
  }, [variableReferencesData]);

  const tokenProps: TTokenProps<TReferenceExtended> = useMemo(() => {
    if (tokensDisabled) return { tokensDisabled: true };
    return {
      tokenPrefix: "${",
      tokenSuffix: "}",
      tokens: tokens,
      tokensNoneAvailableMessage: "No references available yet",
      tokensNoMatchingMessage: "No matching references",
      tokensErrorMessage: variableReferencesError?.message || null,
      dropdownButtonText: "Reference",
      DropdownButtonIcon: Link2Icon,
    };
  }, [tokensDisabled, tokens, variableReferencesError]);

  const form = useAppForm({
    defaultValues: {
      variables: [{ name: "", value: "" }] as TVariableForCreate[],
    },
    validators: {
      onChange: CreateVariablesFormSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      if (!tokens) {
        toast.warning("Variable references unavailable", {
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
        toast.error("Failed to refetch", {
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
        <VariablesFormField form={form} tokenProps={tokenProps} />
        <div className="bg-background-hover flex w-full flex-col gap-3 rounded-b-xl border-t p-2 md:mt-3.5 md:p-2.5">
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
