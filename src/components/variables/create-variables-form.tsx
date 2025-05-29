import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { splitByTokens, TToken, TTokenProps } from "@/components/ui/textarea-with-tokens";
import { cn } from "@/components/ui/utils";
import { getReferenceVariableReadableNames } from "@/components/variables/helpers";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import { VariablesFormField } from "@/components/variables/variables-form-field";
import { useVariables } from "@/components/variables/variables-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  TAvailableVariableReference,
  TVariableForCreate,
  TVariableReferenceForCreate,
  VariableForCreateSchema,
  VariableReferenceForCreateSchema,
} from "@/server/trpc/api/variables/types";
import { Link2Icon } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

type TProps = {
  onValueChange?: TCreateVariablesFormOnBlur;
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
  onValueChange,
  isOpen: isOpenProp,
}: TProps) {
  const {
    list: { refetch: refetchVariables },
    createOrUpdate: { mutateAsync: createOrUpdateVariables, error: createError },
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
    listeners: {
      onChange: ({ formApi }) => {
        if (!onValueChange) return;
        const { variables, variableReferences } = getVariablesPair({
          variables: formApi.state.values.variables,
          tokens: tokens || [],
        });
        onValueChange({
          variables,
          variableReferences,
        });
      },
    },
    onSubmit: async ({ formApi, value }) => {
      if (!tokens) return;

      const { variables, variableReferences } = getVariablesPair({
        variables: value.variables,
        tokens,
      });

      await createOrUpdateVariables({
        ...typedProps,
        variables,
        variableReferences,
      });

      for (const i of value.variables) {
        const id = getNewEntityIdForVariable({ name: i.name, value: i.value });
        temporarilyAddNewEntity(id);
      }
      for (const i of variableReferences) {
        const id = getNewEntityIdForVariable({ name: i.name, value: i.value });
        temporarilyAddNewEntity(id);
      }

      await refetchVariables();

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
          form.handleSubmit();
        }}
      >
        <VariablesFormField form={form} tokenProps={tokenProps} />
        <div className="bg-background-hover flex w-full flex-col gap-3 rounded-b-xl border-t p-2 md:mt-3.5 md:p-2.5">
          {createError && <ErrorLine message={createError.message} />}
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

function getVariablesPair({
  variables,
  tokens,
}: {
  variables: TVariableForCreate[];
  tokens: TToken<TReferenceExtended>[];
}) {
  const variablesWithTokens = variables.map((v) => ({
    name: v.name,
    value: splitByTokens(v.value, tokens),
  }));

  const variablesRegular: TVariableForCreate[] = variablesWithTokens
    .filter((v) => v.value.every((v) => v.token === null))
    .map((v) => ({ name: v.name, value: v.value.map((i) => i.value).join("") }));

  const variableReferences: TVariableReferenceForCreate[] = variablesWithTokens
    .filter((v) => v.value.some((v) => v.token !== null))
    .map((v) => {
      // TODO: Filter to only unique sources
      const sources: TVariableReferenceForCreate["sources"] = v.value
        .filter((i) => i.token !== null)
        .map((i) => {
          const t = i.token!;
          return {
            key: t.object.key,
            type: t.object.type,
            source_id: t.object.source_id,
            source_kubernetes_name: t.object.source_kubernetes_name,
            source_type: t.object.source_type,
            source_name: t.object.source_name,
            source_icon: t.object.source_icon,
          };
        });

      return {
        name: v.name,
        value: v.value.map((i) => (i.token !== null ? i.token.object.template : i.value)).join(""),
        sources,
      };
    });
  return {
    variables: variablesRegular,
    variableReferences,
  };
}
