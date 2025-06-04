"use client";

import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { splitByTokens, TSplitItem, TToken } from "@/components/ui/textarea-with-tokens";
import { cn } from "@/components/ui/utils";
import { getReferenceVariableReadableNames } from "@/components/variables/helpers";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import { useVariablesUtils } from "@/components/variables/variables-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  TVariableReferenceShallow,
  TVariableReferenceShallowSource,
  TVariableShallow,
  VariableForCreateValueSchema,
} from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import {
  CheckIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  KeyIcon,
  Link2Icon,
  LockIcon,
  PenIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { Dispatch, FC, ReactNode, useMemo, useState } from "react";
import { z } from "zod";

const hiddenString = "••••••••••";
const tokenPrefix = "${";
const tokenSuffix = "}";

export type TVariableOrReferenceShallow =
  | ({ variable_type: "regular" } & TVariableShallow)
  | ({ variable_type: "reference" } & TVariableReferenceShallow);

type TPlaceholderProps = {
  isPlaceholder: true;
  variable?: never;
  variableTypeProps?: never;
};

type TVariableProps = {
  variable: TVariableOrReferenceShallow;
  variableTypeProps: TEntityVariableTypeProps;
  isPlaceholder?: never;
};

type TVariableOrPlaceholderProps = TVariableProps | TPlaceholderProps;

type TProps = {
  asElement?: "div" | "li";
  disableDelete?: boolean;
  disableEdit?: boolean;
  disableCopy?: boolean;
  hideThreeDotButton?: boolean;
  Icon?: FC<{ className?: string }>;
} & TVariableOrPlaceholderProps;

export default function VariableCard({
  variable,
  variableTypeProps,
  isPlaceholder,
  disableDelete,
  disableEdit,
  disableCopy,
  hideThreeDotButton,
  Icon,
  asElement = "div",
}: TProps) {
  const Element = asElement === "li" ? "li" : "div";
  const [isValueVisible, setIsValueVisible] = useState(false);
  const [isEditingVariable, setIsEditingVariable] = useState(false);

  const variableValueParts: TSplitItem<TVariableReferenceShallowSource>[] = useMemo(() => {
    if (isPlaceholder) return [{ value: hiddenString, token: null }];
    if (variable.variable_type !== "reference") return [{ value: hiddenString, token: null }];

    const sources = variable.sources;
    const sourceMap = new Map<string, string>();

    sources.forEach((source) => {
      const key = source.key;
      const { sourceName: _sourceName, readableKey: _readableKey } =
        getReferenceVariableReadableNames({
          key,
          object: source,
        });
      const sourceName = _sourceName;
      let readableKey = _readableKey;

      const number = 1;

      if (source.type === "internal_endpoint") {
        readableKey = source.key.replace(source.source_kubernetes_name, `UNBIND_INTERNAL_URL`);
        if (number > 1) readableKey += `_${number}`;
      } else if (source.type === "external_endpoint") {
        readableKey = `UNBIND_EXTERNAL_URL`;
        if (number > 1) readableKey += `_${number}`;
      }

      sourceMap.set(
        `${tokenPrefix}${source.source_kubernetes_name}.${source.key}${tokenSuffix}`,
        `${tokenPrefix}${sourceName}.${readableKey}${tokenSuffix}`,
      );
    });

    let textValue = variable.value;
    sourceMap.forEach((readableKey, key) => {
      textValue = textValue.replaceAll(key, readableKey);
    });

    const tokens: TToken<TVariableReferenceShallowSource>[] = variable.sources.map((source) => {
      const value =
        sourceMap.get(
          `${tokenPrefix}${source.source_kubernetes_name}.${source.key}${tokenSuffix}`,
        ) || "";
      return {
        object: source,
        value,
      };
    });

    const splitItems = splitByTokens<TVariableReferenceShallowSource>(textValue, tokens);
    return splitItems;
  }, [variable, isPlaceholder]);

  const referenceError =
    variable?.variable_type === "reference" && variable.error ? variable.error : null;

  const placeholderOrVariableProps: TVariableOrPlaceholderProps = useMemo(() => {
    if (isPlaceholder) {
      return { isPlaceholder: true };
    }
    return {
      variable,
      variableTypeProps,
    };
  }, [isPlaceholder, variable, variableTypeProps]);

  return (
    <Element
      data-placeholder={isPlaceholder ? true : undefined}
      data-value-visible={isValueVisible ? true : undefined}
      data-not-editing={!isEditingVariable ? true : undefined}
      data-type={variable?.variable_type}
      data-reference-error={referenceError ? true : undefined}
      className="data-reference-error:bg-destructive/4 group/card data-reference-error:border-destructive/12 relative flex w-full flex-col rounded-xl border px-3 py-0.75 data-placeholder:text-transparent sm:flex-row sm:items-start sm:rounded-lg sm:pr-0.75"
    >
      {variable && (
        <NewEntityIndicator
          id={getNewEntityIdForVariable({ name: variable.name, value: variable.value })}
        />
      )}
      <div className="flex h-9 w-full shrink-0 items-center py-2 pr-8 sm:w-56 sm:pr-4 md:w-64">
        {Icon && <Icon className="text-foreground mr-2 size-3.5 shrink-0" />}
        {!Icon && variable?.variable_type === "reference" && (
          <Link2Icon className="text-process mr-2 size-3.5 shrink-0" />
        )}
        {!Icon && variable?.variable_type === "regular" && (
          <KeyIcon className="text-foreground mr-2 size-3.5 shrink-0" />
        )}
        {isPlaceholder && (
          <div className="bg-foreground animate-skeleton mr-2 size-3.5 shrink-0 rounded-full" />
        )}
        <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden font-mono text-sm leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
          {isPlaceholder ? "Loading key" : variable.name}
        </p>
      </div>
      <div className="relative -ml-2 flex w-[calc(100%+1rem)] min-w-0 flex-1 items-start sm:mt-0 sm:w-auto">
        {(!variable || !isEditingVariable) && (
          <>
            <CopyButton
              valueToCopy={variable?.value}
              isPlaceholder={isPlaceholder}
              disableCopy={disableCopy}
              classNameIcon="size-4"
            />
            <Button
              data-visible={isValueVisible ? true : undefined}
              onClick={() => setIsValueVisible((prev) => !prev)}
              variant="ghost"
              forceMinSize="medium"
              size="icon"
              className="text-muted-more-foreground group/button rounded-lg group-data-placeholder/card:text-transparent sm:rounded-md"
              disabled={isPlaceholder || referenceError !== null}
              fadeOnDisabled={false}
            >
              <div className="relative size-4">
                {referenceError ? (
                  <TriangleAlertIcon className="text-destructive size-full" />
                ) : (
                  <>
                    <EyeIcon className="size-full group-data-visible/button:opacity-0" />
                    <EyeOffIcon className="absolute top-0 left-0 size-full opacity-0 group-data-visible/button:opacity-100" />
                    {isPlaceholder && (
                      <div className="bg-muted-more-foreground animate-skeleton absolute top-0 left-0 size-full rounded-sm" />
                    )}
                  </>
                )}
              </div>
            </Button>
            <div className="relative flex min-h-9 min-w-0 flex-1 items-center justify-start pl-2">
              <ScrollArea
                className="max-h-[min(16rem,50vh)] w-full [mask-image:linear-gradient(to_bottom,transparent_0%,black_0.375rem,black_calc(100%_-_0.375rem),transparent_100%)]"
                classNameViewport="py-1.5"
              >
                <div className="flex w-full justify-start">
                  <p className="group-data-placeholder/card:bg-foreground group-data-reference-error/card:text-destructive group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden px-0.25 py-0.25 pr-2 font-mono text-xs leading-tight whitespace-pre-wrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
                    {referenceError
                      ? "The referenced value doesn't exist anymore. Consider deleting this."
                      : isPlaceholder || !isValueVisible
                        ? hiddenString
                        : variable.variable_type === "reference"
                          ? variableValueParts.map((part, index) => (
                              <span
                                data-token={part.token !== null ? true : undefined}
                                key={index}
                                className="data-token:bg-process/10 data-token:ring-process/20 data-token:text-process data-token:rounded-[2px] data-token:ring-1"
                              >
                                {part.token !== null ? (
                                  <>
                                    <span className="text-process/50">
                                      {part.value.slice(0, tokenPrefix.length)}
                                    </span>
                                    <span>
                                      {part.value.slice(
                                        tokenPrefix.length,
                                        part.value.length - tokenSuffix.length,
                                      )}
                                    </span>
                                    <span className="text-process/50">
                                      {part.value.slice(
                                        part.value.length - tokenSuffix.length,
                                        part.value.length,
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  part.value
                                )}
                              </span>
                            ))
                          : variable.value}
                  </p>
                </div>
              </ScrollArea>
            </div>
            <div className="hidden sm:flex">
              {!hideThreeDotButton && (
                <ConditionalDropdownButton
                  {...placeholderOrVariableProps}
                  referenceError={referenceError}
                  disableDelete={disableDelete}
                  disableEdit={disableEdit}
                  setIsEditingVariable={setIsEditingVariable}
                />
              )}
            </div>
          </>
        )}
        {variable && isEditingVariable && (
          <EditVariableForm
            variable={variable}
            variableTypeProps={variableTypeProps}
            setIsEditingVariable={setIsEditingVariable}
          />
        )}
      </div>
      {(!isEditingVariable || !variable) && (
        <div className="absolute top-0.75 right-0.75 sm:hidden">
          {!hideThreeDotButton && (
            <ConditionalDropdownButton
              {...placeholderOrVariableProps}
              referenceError={referenceError}
              disableDelete={disableDelete}
              disableEdit={disableEdit}
              setIsEditingVariable={setIsEditingVariable}
              className="rounded-lg"
            />
          )}
        </div>
      )}
    </Element>
  );
}

export function getNewEntityIdForVariable({ name, value }: { name: string; value: string }) {
  return `${name}|${value}`;
}

function ConditionalDropdownButton({
  isPlaceholder,
  variable,
  variableTypeProps,
  disableEdit,
  disableDelete,
  referenceError,
  setIsEditingVariable,
  className,
}: TVariableOrPlaceholderProps & {
  disableDelete?: boolean;
  disableEdit?: boolean;
  referenceError: string | null;
  setIsEditingVariable: Dispatch<React.SetStateAction<boolean>>;
  className?: string;
}) {
  if (isPlaceholder) {
    return (
      <Button
        disabled
        fadeOnDisabled={false}
        variant="ghost"
        size="icon"
        className={cn("rounded-md", className)}
      >
        <div className="bg-muted-more-foreground animate-skeleton size-6 rounded-md" />
      </Button>
    );
  }

  if (referenceError) {
    return (
      <DeleteTrigger
        variable={variable}
        variableTypeProps={variableTypeProps}
        closeDropdown={() => setIsEditingVariable(false)}
      >
        <Button
          aria-label="Delete"
          fadeOnDisabled={false}
          variant="ghost-destructive"
          size="icon"
          className={cn("text-destructive/75 group/button rounded-md", className)}
        >
          <Trash2Icon className="size-5 transition-transform" />
        </Button>
      </DeleteTrigger>
    );
  }

  return (
    <ThreeDotButton
      variable={variable}
      variableTypeProps={variableTypeProps}
      setIsEditingVariable={setIsEditingVariable}
      className={className}
      disableEdit={disableEdit}
      disableDelete={disableDelete}
    />
  );
}

function ThreeDotButton({
  variable,
  variableTypeProps,
  setIsEditingVariable,
  disableDelete,
  disableEdit,
  className,
}: {
  variable: TVariableOrReferenceShallow;
  variableTypeProps: TEntityVariableTypeProps;
  setIsEditingVariable: Dispatch<React.SetStateAction<boolean>>;
  disableDelete?: boolean;
  disableEdit?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isLocked = disableDelete === true && disableEdit === true;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isOpen ? true : undefined}
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-more-foreground group/button rounded-md group-data-placeholder/card:text-transparent",
            className,
          )}
        >
          {isLocked ? (
            <div className="relative size-5 transition-transform group-data-open/button:rotate-90">
              <LockIcon className="size-full transition-opacity group-data-open/button:opacity-0" />
              <XIcon
                strokeWidth={2.25}
                className="absolute top-0 left-0 size-full opacity-0 transition-opacity group-data-open/button:opacity-100"
              />
            </div>
          ) : (
            <EllipsisVerticalIcon className="size-6 transition-transform group-data-open/button:rotate-90" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-locked={isLocked ? true : undefined}
        className="z-50 w-40 data-locked:w-68"
        sideOffset={-1}
        data-open={isOpen ? true : undefined}
        align="end"
        forceMount={true}
      >
        <ScrollArea>
          <DropdownMenuGroup>
            {isLocked && (
              <div className="text-muted-foreground flex w-full items-start justify-start gap-1.5 px-3 py-1.75 text-sm">
                <InfoIcon className="-ml-1 size-4 shrink-0" />
                <p className="-mt-0.5 min-w-0 shrink">
                  {"This variable is auto-generated. It can't be edited or deleted."}
                </p>
              </div>
            )}
            {!isLocked && (
              <DropdownMenuItem
                disabled={disableEdit}
                onSelect={() => setIsEditingVariable((o) => !o)}
              >
                {!disableEdit ? (
                  <PenIcon className="-ml-0.5 size-5" />
                ) : (
                  <LockIcon className="-ml-0.5 size-5" />
                )}
                <p className="min-w-0 shrink leading-tight">Edit</p>
              </DropdownMenuItem>
            )}
            {!isLocked && (
              <DeleteTrigger
                variable={variable}
                variableTypeProps={variableTypeProps}
                closeDropdown={() => setIsOpen(false)}
              >
                <DropdownMenuItem
                  disabled={disableDelete}
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
                >
                  {!disableDelete ? (
                    <Trash2Icon className="-ml-0.5 size-5" />
                  ) : (
                    <LockIcon className="-ml-0.5 size-5" />
                  )}
                  <p className="min-w-0 shrink leading-tight">Delete</p>
                </DropdownMenuItem>
              </DeleteTrigger>
            )}
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditVariableForm({
  variable,
  variableTypeProps,
  setIsEditingVariable,
}: {
  variable: TVariableOrReferenceShallow;
  variableTypeProps: TEntityVariableTypeProps;
  setIsEditingVariable: Dispatch<React.SetStateAction<boolean>>;
}) {
  const { refetch } = useVariablesUtils({
    ...variableTypeProps,
  });

  const { mutateAsync: upsertVariables, error } = api.variables.createOrUpdate.useMutation({
    onSuccess: () => {},
  });

  const form = useAppForm({
    defaultValues: {
      variableValue: variable.value,
    },
    validators: {
      onChange: z.object({ variableValue: VariableForCreateValueSchema }),
    },
    onSubmit: async (d) => {
      if (d.value.variableValue === variable.value) {
        setIsEditingVariable(false);
        return;
      }
      await upsertVariables({
        ...variableTypeProps,
        variables: [{ name: variable.name, value: d.value.variableValue }],
        variableReferences: [],
      });
      refetch();
      setIsEditingVariable(false);
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="bg-background flex flex-1 items-start justify-start gap-1 rounded-lg"
      >
        <form.AppField
          name="variableValue"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="flex-1"
              placeholder="abc123"
              classNameInput="rounded-lg px-2.5 py-1.5 h-9 sm:rounded-md font-mono"
              classNameInfo="pt-1 pb-0.5 text-xs"
            />
          )}
        />
        <form.Subscribe
          selector={(state) => ({ isSubmitting: state.isSubmitting })}
          children={({ isSubmitting }) => (
            <>
              <Button
                disabled={isSubmitting}
                type="button"
                onClick={() => setIsEditingVariable(false)}
                aria-label="Cancel"
                size="icon"
                variant="outline"
                className="rounded-lg sm:rounded-md"
              >
                <XIcon className="size-5" />
              </Button>
              <div className="size-9 py-[0.5px]">
                <form.SubmitButton
                  spinnerVariants={{ size: "icon" }}
                  aria-label="Confirm"
                  size="icon"
                  className="h-full rounded-lg sm:rounded-md"
                  isPending={isSubmitting}
                >
                  <CheckIcon className="size-5" strokeWidth={2.5} />
                </form.SubmitButton>
              </div>
            </>
          )}
        />
      </form>
      {error && (
        <ErrorLine
          message={error.message}
          className="rounded-lg px-2 py-1.5 text-xs sm:rounded-md"
        />
      )}
    </div>
  );
}

function DeleteTrigger({
  variable,
  variableTypeProps,
  closeDropdown,
  children,
}: {
  variable: TVariableOrReferenceShallow;
  variableTypeProps: TEntityVariableTypeProps;
  closeDropdown: () => void;
  children: ReactNode;
}) {
  const { invalidate: invalidateVariables, optimisticRemove: optimisticRemoveVariables } =
    useVariablesUtils({
      ...variableTypeProps,
    });

  const {
    mutateAsync: deleteVariable,
    error,
    reset,
  } = api.variables.delete.useMutation({
    onSuccess: async () => {
      optimisticRemoveVariables({
        variables: variable.variable_type === "reference" ? [] : [variable],
        variableReferences: variable.variable_type === "reference" ? [variable] : [],
      });
      invalidateVariables();
      closeDropdown();
    },
  });

  return (
    <DeleteEntityTrigger
      dialogTitle="Delete Variable"
      dialogDescription="Are you sure you want to delete this variable? This action cannot be undone."
      deletingEntityName={variable.name}
      disableConfirmationInput
      EntityNameBadge={() => (
        <p className="bg-foreground/6 border-foreground/6 -ml-0.5 max-w-[calc(100%+0.25rem)] rounded-md border px-1.5 font-mono font-semibold">
          {variable.name}
        </p>
      )}
      onDialogClose={() => {
        reset();
      }}
      onDialogCloseImmediate={() => {
        closeDropdown();
      }}
      error={error}
      onSubmit={async () => {
        await deleteVariable({
          ...variableTypeProps,
          variables: variable.variable_type === "reference" ? [] : [{ name: variable.name }],
          variableReferenceIds: variable.variable_type === "reference" ? [variable.id] : [],
        });
      }}
    >
      {children}
    </DeleteEntityTrigger>
  );
}
