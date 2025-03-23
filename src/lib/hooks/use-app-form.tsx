import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { Input, InputProps } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { AnyFieldApi, createFormHook, createFormHookContexts } from "@tanstack/react-form";

const { fieldContext, formContext } = createFormHookContexts();

function InputWithInfo({
  className,
  hideInfo,
  field,
  ...rest
}: InputProps & { field: AnyFieldApi; hideInfo?: boolean }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <Input {...rest} className="w-full" />
      {!hideInfo && field.state.meta.isTouched && field.state.meta.errors.length ? (
        <ErrorLine
          className="bg-transparent py-1.5 pl-1.5"
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField: InputWithInfo,
    NumberField: InputWithInfo,
  },
  formComponents: {
    SubmitButton: Button,
  },
  fieldContext,
  formContext,
});
