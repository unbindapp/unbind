import ErrorLine from "@/components/error-line";
import TokenField, { type TTokenFieldProps } from "@/components/ui/token-field/token-field";
import { cn } from "@/components/ui/utils";
import { useFieldError, type TFieldProps } from "@/lib/hooks/use-app-form";

export type TTokenFieldWithInfoProps = TTokenFieldProps & TFieldProps;

export default function TokenFieldWithInfo({
  className,
  hideError,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  ...rest
}: TTokenFieldWithInfoProps) {
  const { hasError, formDomId } = useFieldError(field, dontCheckUntilSubmit);

  if (hideError) {
    return <TokenField {...rest} className={cn("w-full", className, classNameInput)} />;
  }

  return (
    <div
      data-form-id={formDomId}
      data-invalid={hasError || undefined}
      className={cn("flex flex-col", className)}
    >
      <TokenField {...rest} className={cn("w-full", classNameInput)} />
      {hasError ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}
