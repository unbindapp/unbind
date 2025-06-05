import { Button } from "@/components/ui/button";
import { TTokenProps } from "@/components/ui/textarea-with-tokens";
import { withForm } from "@/lib/hooks/use-app-form";
import { TAvailableVariableReference, TVariableForCreate } from "@/server/trpc/api/variables/types";
import { Link2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback } from "react";

const tokenProps: TTokenProps<TReferenceExtended> = {
  tokens: [],
  tokenPrefix: "${",
  tokenSuffix: "}",
  tokensNoneAvailableMessage: "No references available yet",
  tokensNoMatchingMessage: "No matching references",
  dropdownButtonText: "Reference",
  DropdownButtonIcon: Link2Icon,
  tokensErrorMessage: null,
};

export const variablesFormFieldDefaultVariables: TVariableForCreate[] = [{ name: "", value: "" }];

const props: {
  tokenProps: TTokenProps<TReferenceExtended>;
} = { tokenProps };

export const VariablesFormField = withForm({
  defaultValues: {
    variables: variablesFormFieldDefaultVariables,
  },
  props,
  render: function Render({ form, tokenProps }) {
    const onPaste = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const text = clipboardData.getData("text");
        const variables = getVariablesFromRawText(text);

        if (
          variables.length === 0 ||
          (variables.length === 1 && (!variables[0].name || !variables[0].value))
        ) {
          return;
        }

        e.preventDefault();

        for (let i = 0; i < variables.length; i++) {
          const variable = variables[i];
          if (
            i === 0 &&
            !form.state.values.variables[index].name &&
            !form.state.values.variables[index].value
          ) {
            form.replaceFieldValue("variables", index, variable);
            continue;
          }
          form.insertFieldValue("variables", index + i, variable);
        }
      },
      [form],
    );

    return (
      <form.AppField
        name="variables"
        mode="array"
        children={(field) => (
          <div className="flex w-full flex-col items-start gap-2">
            {/* All secret rows */}
            <div className="flex w-full flex-col items-start gap-1">
              {field.state.value.map((_, i) => {
                return (
                  <div key={`secret-wrapper-${i}`} className="flex w-full flex-col gap-1 md:gap-0">
                    {i !== 0 && <div className="bg-border h-px w-full md:hidden" />}
                    <div
                      key={`secret-${i}`}
                      data-first={i === 0 ? true : undefined}
                      className="relative flex w-full flex-col gap-2 p-3 md:flex-row md:items-start md:px-4 md:py-0.5"
                    >
                      <form.AppField key={`variables[${i}].name`} name={`variables[${i}].name`}>
                        {(subField) => {
                          return (
                            <field.TextField
                              dontCheckUntilSubmit
                              field={subField}
                              value={subField.state.value}
                              onBlur={subField.handleBlur}
                              onPaste={(e) => onPaste(e, i)}
                              onChange={(e) => {
                                subField.handleChange(e.target.value);
                              }}
                              placeholder="VARIABLE_NAME"
                              classNameInput="font-mono"
                              className="mr-12.5 flex-1 md:mr-0 md:max-w-64"
                              autoCapitalize="off"
                              autoCorrect="off"
                              autoComplete="off"
                              spellCheck="false"
                            />
                          );
                        }}
                      </form.AppField>
                      <form.AppField key={`variables[${i}].value`} name={`variables[${i}].value`}>
                        {(subField) => {
                          return (
                            <field.TextareaWithTokens
                              {...tokenProps}
                              dontCheckUntilSubmit
                              field={subField}
                              value={subField.state.value}
                              onBlur={subField.handleBlur}
                              onChange={(e) => subField.handleChange(e.target.value)}
                              classNameTextarea="font-mono"
                              classNameDropdownContent="font-mono"
                              className="flex-1"
                              placeholder={
                                tokenProps.tokensDisabled ? "Value" : "Value or ${Reference}"
                              }
                              autoCapitalize="off"
                              autoCorrect="off"
                              autoComplete="off"
                              spellCheck="false"
                            />
                          );
                        }}
                      </form.AppField>
                      <form.Subscribe
                        selector={(state) => ({ firstVariable: state.values.variables[0] })}
                        children={({ firstVariable }) => (
                          <Button
                            disabled={
                              field.state.value.length <= 1 &&
                              firstVariable.name === "" &&
                              firstVariable.value === ""
                            }
                            type="button"
                            variant="outline"
                            size="icon"
                            className="absolute top-3 right-3 h-10.5 w-10.5 md:relative md:top-auto md:right-auto"
                            onClick={() => {
                              if (field.state.value.length <= 1) {
                                form.resetField("variables");
                                return;
                              }
                              field.removeValue(i);
                            }}
                          >
                            <Trash2Icon className="size-5" />
                          </Button>
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="-mt-2 w-full px-3 pb-3 md:-mt-0.5 md:px-4 md:pb-0.5">
              <Button
                type="button"
                variant="outline"
                className="px-4"
                onClick={() => field.pushValue({ name: "", value: "" })}
              >
                <PlusIcon className="-ml-1.25 size-5 shrink-0" />
                <p className="min-w-0 shrink">Add Another</p>
              </Button>
            </div>
          </div>
        )}
      />
    );
  },
});

export function getVariablesFromRawText(text: string) {
  const cleaned = text.trim();
  const lines = cleaned ? cleaned.split("\n") : [];
  const pairs = lines
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [name, ...rest] = line.split("=");
      const value = unwrapQuotes(rest.join("="));
      return { name, value };
    });
  return pairs;
}

export function unwrapQuotes(value: string) {
  let newValue = value;
  if (newValue.startsWith('"') && newValue.endsWith('"')) {
    newValue = newValue.slice(1, -1);
  }
  return newValue;
}

export type TReferenceExtended = TAvailableVariableReference & {
  template: string;
  key: string;
};
