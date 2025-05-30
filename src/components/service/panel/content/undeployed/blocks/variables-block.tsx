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
import { useStore } from "@tanstack/react-form";
import { ChevronUpIcon, KeyIcon, Link2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TOnTokensChanged = (tokens: TToken<TReferenceExtended>[] | undefined) => void;

const VariablesBlock = withForm({
  defaultValues: {
    variables: variablesFormFieldDefaultVariables,
  },
  props: {
    className: "",
    onTokensChanged: (() => {}) as TOnTokensChanged | undefined,
  },
  render: function Render({ form, className, onTokensChanged }) {
    const {
      list: { data: variableReferencesData, error: variableReferencesError },
    } = useVariableReferences();

    const [isOpen, setIsOpen] = useState(false);

    const variableErrors = useStore(form.store, (s) => s.fieldMeta.variables?.errors);

    useEffect(() => {
      if (variableErrors && variableErrors.length > 0) setIsOpen(true);
    }, [variableErrors]);

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

    useEffect(() => {
      onTokensChanged?.(tokens);
    }, [tokens, onTokensChanged]);

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
          <div className="relative size-5 shrink-0 transition-transform group-data-open/section:rotate-135">
            <KeyIcon className="size-full scale-80 transition-opacity group-data-open/section:opacity-0" />
            <ChevronUpIcon className="absolute top-0 left-0 size-full -rotate-135 opacity-0 transition-opacity group-data-open/section:opacity-100" />
          </div>
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
