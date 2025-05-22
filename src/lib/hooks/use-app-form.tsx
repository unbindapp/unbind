import ErrorLine from "@/components/error-line";
import { DomainCard } from "@/components/service/panel/content/undeployed/domain-card";
import { Button } from "@/components/ui/button";
import { Input, InputProps } from "@/components/ui/input";
import { Slider, SliderProps } from "@/components/ui/slider";
import TextareaWithTokens, { TTextareaWithTokensProps } from "@/components/ui/textarea-with-tokens";
import { cn } from "@/components/ui/utils";
import { appLocale } from "@/lib/constants";
import {
  AnyFieldApi,
  createFormHook,
  createFormHookContexts,
  useStore,
} from "@tanstack/react-form";
import { useCallback } from "react";
import { z } from "zod";

const { fieldContext, formContext } = createFormHookContexts();

type TFieldProps = {
  field: AnyFieldApi;
  hideInfo?: boolean;
  dontCheckUntilSubmit?: boolean;
  classNameInput?: string;
  classNameInfo?: string;
};

type TInputWithInfoProps = TFieldProps & InputProps;
type TSliderWithInfoProps = TFieldProps &
  SliderProps & {
    classNameMin?: string;
    classNameMax?: string;
    minMaxFormatter?: (value: number) => string;
  };

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
    return (
      <div className={cn("flex w-full flex-col", className)}>
        <Input {...rest} className={cn("z-10 w-full", classNameInput)} />
        <DomainCard domain={field.state.value} className="-mt-3 rounded-t-none pt-2.75" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <Input {...rest} className={cn("z-10 w-full", classNameInput)} />
      <DomainCard domain={field.state.value} className="-mt-3 rounded-t-none pt-2.75" />
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
  classNameMin,
  classNameMax,
  minMaxFormatter,
  ...rest
}: TSliderWithInfoProps) {
  const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
  const isFormSubmitted = submissionAttempts > 0;
  const classNameMinMax = "min-w-0 text-muted-foreground shrink leading-tight text-xs font-medium";

  const Min = useCallback(() => {
    if (rest.min === undefined) return null;
    return (
      <p className={cn(classNameMinMax, classNameMin)}>
        {minMaxFormatter ? minMaxFormatter(rest.min) : rest.min.toLocaleString(appLocale)}
      </p>
    );
  }, [classNameMinMax, classNameMin, minMaxFormatter, rest.min]);

  const Max = useCallback(() => {
    if (rest.max === undefined) return null;
    return (
      <p className={cn(classNameMinMax, classNameMax)}>
        {minMaxFormatter ? minMaxFormatter(rest.max) : rest.max.toLocaleString(appLocale)}
      </p>
    );
  }, [classNameMinMax, classNameMax, minMaxFormatter, rest.max]);

  if (hideInfo) {
    return (
      <div className={cn("flex w-full gap-3", className)}>
        <Min />
        <Slider {...rest} className={cn("flex-1", classNameInput)} />
        <Max />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex w-full gap-3">
        <Min />
        <Slider {...rest} className={cn("flex-1", classNameInput)} />
        <Max />
      </div>
      {(field.state.meta.isTouched || isFormSubmitted) &&
      (field.state.meta.isBlurred || isFormSubmitted) &&
      (!dontCheckUntilSubmit || isFormSubmitted) &&
      field.state.meta.errors.length ? (
        <ErrorLine
          className={cn("mt-1 bg-transparent py-1.5 pl-1.5", classNameInfo)}
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

export const DomainFieldSchema = z.string().url();
