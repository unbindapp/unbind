import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { Input, InputProps } from "@/components/ui/input";
import { Slider, SliderProps } from "@/components/ui/slider";
import TextareaWithTokens, { TTextareaWithTokensProps } from "@/components/ui/textarea-with-tokens";
import { cn } from "@/components/ui/utils";
import {
  AnyFieldApi,
  createFormHook,
  createFormHookContexts,
  useStore,
} from "@tanstack/react-form";

const { fieldContext, formContext } = createFormHookContexts();

type TFieldProps = {
  field: AnyFieldApi;
  hideInfo?: boolean;
  dontCheckUntilSubmit?: boolean;
  classNameInput?: string;
  classNameInfo?: string;
};

type TInputWithInfoProps = TFieldProps & InputProps;
type TSliderWithInfoProps = TFieldProps & SliderProps;

function InputWithInfo({
  className,
  hideInfo,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  ...rest
}: TInputWithInfoProps) {
  const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
  const isFormSubmitted = submissionAttempts > 0;

  if (hideInfo) {
    return <Input {...rest} className={cn("w-full", className, classNameInput)} />;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <Input {...rest} className={cn("w-full", classNameInput)} />
      {(field.state.meta.isTouched || isFormSubmitted) &&
      (field.state.meta.isBlurred || isFormSubmitted) &&
      (!dontCheckUntilSubmit || isFormSubmitted) &&
      field.state.meta.errors.length ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

function TextareaWithTokensWithInfo<T>({
  className,
  hideInfo,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  ...rest
}: TTextareaWithTokensProps<T> & TFieldProps) {
  const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
  const isFormSubmitted = submissionAttempts > 0;

  if (hideInfo) {
    return <TextareaWithTokens {...rest} className={cn("w-full", className, classNameInput)} />;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <TextareaWithTokens {...rest} className={cn("w-full", classNameInput)} />
      {(field.state.meta.isTouched || isFormSubmitted) &&
      (field.state.meta.isBlurred || isFormSubmitted) &&
      (!dontCheckUntilSubmit || isFormSubmitted) &&
      field.state.meta.errors.length ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

function DomainInput({
  className,
  hideInfo,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  ...rest
}: TInputWithInfoProps) {
  const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
  const isFormSubmitted = submissionAttempts > 0;

  if (hideInfo) {
    return <Input {...rest} className={cn("w-full", className, classNameInput)} />;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <Input {...rest} className={cn("w-full", classNameInput)} />
      {(field.state.meta.isTouched || isFormSubmitted) &&
      (field.state.meta.isBlurred || isFormSubmitted) &&
      (!dontCheckUntilSubmit || isFormSubmitted) &&
      field.state.meta.errors.length ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

function StorageSizeInput({
  className,
  hideInfo,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  ...rest
}: TSliderWithInfoProps) {
  const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
  const isFormSubmitted = submissionAttempts > 0;

  if (hideInfo) {
    return <Slider {...rest} className={cn("w-full", className, classNameInput)} />;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <Slider {...rest} className={cn("w-full", classNameInput)} />
      {(field.state.meta.isTouched || isFormSubmitted) &&
      (field.state.meta.isBlurred || isFormSubmitted) &&
      (!dontCheckUntilSubmit || isFormSubmitted) &&
      field.state.meta.errors.length ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", classNameInfo)}
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
    TextareaWithTokens: TextareaWithTokensWithInfo,
    DomainInput,
    StorageSizeInput,
  },
  formComponents: {
    SubmitButton: Button,
  },
  fieldContext,
  formContext,
});
