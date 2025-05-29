import BrandIcon from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { TToken, TTokenProps } from "@/components/ui/textarea-with-tokens";
import { cn } from "@/components/ui/utils";
import { getReferenceVariableReadableNames } from "@/components/variables/helpers";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import {
  TReferenceExtended,
  VariablesFormField,
  variablesFormFieldDefaultVariables,
} from "@/components/variables/variables-form-field";
import { withForm } from "@/lib/hooks/use-app-form";
import { ChevronDownIcon, Link2Icon } from "lucide-react";
import { useMemo, useState } from "react";

const VariablesBlock = withForm({
  defaultValues: {
    variables: variablesFormFieldDefaultVariables,
  },
  props: {
    className: "",
  },
  render: function Render({ form, className }) {
    const {
      list: { data: variableReferencesData, error: variableReferencesError },
    } = useVariableReferences();

    const [isOpen, setIsOpen] = useState(false);

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
    }, [tokens, variableReferencesError]);

    return (
      <div
        data-open={isOpen ? true : undefined}
        className={cn("group/section mt-1 flex w-full flex-col rounded-lg border", className)}
      >
        <Button
          className="text-muted-foreground justify-start gap-2 rounded-md px-3 py-2.75 text-left font-semibold group-data-open/section:rounded-b-none"
          variant="ghost"
          type="button"
          onClick={() => setIsOpen((o) => !o)}
        >
          <ChevronDownIcon className="size-5 transition-transform group-data-open/section:rotate-180" />
          <p className="min-w-0 shrink truncate">Environment Variables</p>
        </Button>
        {isOpen && (
          <div className="flex w-full flex-col pb-1 md:pt-1 md:pb-3.5">
            <VariablesFormField form={form} tokenProps={tokenProps} />
          </div>
        )}
      </div>
    );
  },
});

export default VariablesBlock;
