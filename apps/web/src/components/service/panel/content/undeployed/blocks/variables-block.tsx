import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type { TReferenceExtended, TVariableToken } from "@/components/variables/tokens";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import {
  VariablesFormField,
  variablesFormFieldDefaultVariables,
  type TReferenceProps,
} from "@/components/variables/variables-form-field";
import { withForm } from "@/lib/hooks/use-app-form";
import { useStore } from "@tanstack/react-form";
import { ChevronDownIcon, KeyIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TOnTokensChanged = (tokens: TVariableToken<TReferenceExtended>[] | undefined) => void;

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
      tokens,
      list: { error: variableReferencesError },
    } = useVariableReferences();

    const [isOpen, setIsOpen] = useState(false);

    const variableErrors = useStore(form.store, (s) => s.fieldMeta.variables?.errors);

    useEffect(() => {
      if (variableErrors && variableErrors.length > 0) setIsOpen(true);
    }, [variableErrors]);

    useEffect(() => {
      onTokensChanged?.(tokens);
    }, [tokens, onTokensChanged]);

    const referenceProps: TReferenceProps = useMemo(() => ({ tokens }), [tokens]);

    return (
      <div
        data-open={isOpen || undefined}
        className={cn("group/section mt-1 flex w-full flex-col rounded-lg border", className)}
      >
        <Button
          data-open={isOpen || undefined}
          className="text-muted-foreground justify-start gap-2 rounded-md px-3 py-2.75 text-left font-semibold group-data-open/section:rounded-b-none"
          variant="ghost"
          type="button"
          onClick={() => setIsOpen((o) => !o)}
        >
          <KeyIcon className="size-4.5 shrink-0 transition group-data-open/button:rotate-90" />
          <p className="min-w-0 shrink">Environment Variables</p>
          <ChevronDownIcon className="text-muted-foreground -mr-0.75 ml-auto size-5 shrink-0 transition group-data-open/button:rotate-180" />
        </Button>
        {isOpen && (
          <div className="flex w-full flex-col pb-1 md:pt-1 md:pb-3.5">
            {variableReferencesError && (
              <div className="px-3 pb-1 md:px-4">
                <ErrorLine message={variableReferencesError.message} />
              </div>
            )}
            <VariablesFormField form={form} referenceProps={referenceProps} />
          </div>
        )}
      </div>
    );
  },
});

export default VariablesBlock;
