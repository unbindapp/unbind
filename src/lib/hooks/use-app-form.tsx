import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { Input, InputProps } from "@/components/ui/input";
import TextareaWithTags, { TTextareaWithTagsProps } from "@/components/ui/textarea-with-tags";
import { cn } from "@/components/ui/utils";
import {
  AnyFieldApi,
  createFormHook,
  createFormHookContexts,
  useStore,
} from "@tanstack/react-form";

const { fieldContext, formContext } = createFormHookContexts();

function InputWithInfo({
  className,
  hideInfo,
  field,
  inputClassName,
  infoClassName,
  dontCheckUntilSubmit,
  ...rest
}: InputProps & {
  field: AnyFieldApi;
  hideInfo?: boolean;
  inputClassName?: string;
  infoClassName?: string;
  dontCheckUntilSubmit?: boolean;
}) {
  const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
  const isFormSubmitted = submissionAttempts > 0;

  if (hideInfo) {
    return <Input {...rest} className={cn("w-full", className, inputClassName)} />;
  }
  return (
    <div className={cn("flex flex-col", className)}>
      <Input {...rest} className={cn("w-full", inputClassName)} />
      {(field.state.meta.isTouched || isFormSubmitted) &&
      (field.state.meta.isBlurred || isFormSubmitted) &&
      (!dontCheckUntilSubmit || isFormSubmitted) &&
      field.state.meta.errors.length ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", infoClassName)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

function TextareaWithTagsWithInfo({
  className,
  hideInfo,
  field,
  textareaClassName,
  infoClassName,
  dontCheckUntilSubmit,
  ...rest
}: TTextareaWithTagsProps & {
  field: AnyFieldApi;
  hideInfo?: boolean;
  textareaClassName?: string;
  infoClassName?: string;
  dontCheckUntilSubmit?: boolean;
}) {
  const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
  const isFormSubmitted = submissionAttempts > 0;

  if (hideInfo) {
    return <TextareaWithTags {...rest} className={cn("w-full", className, textareaClassName)} />;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <TextareaWithTags {...rest} className={cn("w-full", textareaClassName)} />
      {(field.state.meta.isTouched || isFormSubmitted) &&
      (field.state.meta.isBlurred || isFormSubmitted) &&
      (!dontCheckUntilSubmit || isFormSubmitted) &&
      field.state.meta.errors.length ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", infoClassName)}
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
    TextareaWithTags: TextareaWithTagsWithInfo,
  },
  formComponents: {
    SubmitButton: Button,
  },
  fieldContext,
  formContext,
});
