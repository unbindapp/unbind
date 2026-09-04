"use client";

import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import { IconCache } from "@/components/icons/icon-cache";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import {
  referenceMapForVariables,
  splitByStoredReferences,
  toReadableValue,
  toStoredValue,
  type TRenderedPart,
} from "@/components/variables/helpers";
import { readableTokenMap } from "@/components/variables/tokens";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import {
  useVariableReferenceLanguage,
  VariableValueField,
} from "@/components/variables/variables-form-field";
import { useVariables, type TVariableWithStaged } from "@/components/variables/variables-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { VariableForCreateValueSchema } from "@/lib/queries/variables";
import {
  CheckIcon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  KeyIcon,
  LockIcon,
  PenIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { Dispatch, FC, useMemo, useState } from "react";
import { z } from "zod";

const hiddenString = "••••••••••";
const unresolvedMessage = "Missing references. They are used as literal text.";

type TPlaceholderProps = {
  isPlaceholder: true;
  variable?: never;
  variableTypeProps?: never;
};

type TVariableProps = {
  variable: TVariableWithStaged;
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
  const isDynamic = !!variable && variable.references.length > 0;
  const hasUnresolved = isDynamic && variable.references.some((r) => !r.resolved);
  const isStagedDelete = variable?.staged === "deleted";

  const renderedParts: TRenderedPart[] = useMemo(
    () =>
      variable && isDynamic ? splitByStoredReferences(variable.value, variable.references) : [],
    [variable, isDynamic],
  );

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
      data-placeholder={isPlaceholder || undefined}
      data-value-visible={isValueVisible || undefined}
      data-not-editing={!isEditingVariable || undefined}
      data-dynamic={isDynamic || undefined}
      data-unresolved={hasUnresolved || undefined}
      data-staged={variable?.staged}
      className="group/card data-unresolved:border-warning/24 data-staged:border-change/40 relative flex w-full flex-col rounded-xl border px-3 py-1 data-placeholder:text-transparent data-[staged=deleted]:opacity-60 sm:flex-row sm:items-start sm:rounded-lg sm:pr-1"
    >
      {variable && (
        <NewEntityIndicator
          id={getNewEntityIdForVariable({ name: variable.name, value: variable.value })}
        />
      )}
      <div className="flex h-9 w-full shrink-0 items-center py-2 pr-8 sm:w-56 sm:pr-4 md:w-64">
        {Icon && <Icon className="text-foreground mr-2 size-3.5 shrink-0" />}
        {!Icon && variable && (
          <KeyIcon
            data-dynamic={isDynamic || undefined}
            data-unresolved={hasUnresolved || undefined}
            className="text-foreground data-dynamic:text-process data-dynamic:data-unresolved:text-warning data-unresolved:text-warning mr-2 size-3.5 shrink-0"
          />
        )}
        {isPlaceholder && (
          <div className="bg-foreground animate-skeleton mr-2 size-3.5 shrink-0 rounded-full" />
        )}
        <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden font-mono text-sm leading-normal text-ellipsis whitespace-nowrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
          {isPlaceholder ? "Loading key" : variable.name}
        </p>
      </div>
      <div className="relative -ml-2 flex w-[calc(100%+1rem)] min-w-0 flex-1 items-start sm:mt-0 sm:w-auto">
        {(!variable || !isEditingVariable) && (
          <>
            <CopyButton
              valueToCopy={variable?.resolved_value ?? variable?.value}
              isPlaceholder={isPlaceholder}
              disableCopy={disableCopy}
              classNameIcon="size-4"
            />
            <Button
              data-visible={isValueVisible || undefined}
              onClick={() => setIsValueVisible((prev) => !prev)}
              variant="ghost"
              forceMinSize="medium"
              size="icon"
              className="text-muted-more-foreground group/button rounded-lg group-data-placeholder/card:text-transparent sm:rounded-md"
              disabled={isPlaceholder}
              fadeOnDisabled={false}
            >
              <div className="relative size-4">
                <EyeIcon className="size-full group-data-visible/button:opacity-0" />
                <EyeOffIcon className="absolute top-0 left-0 size-full opacity-0 group-data-visible/button:opacity-100" />
                {isPlaceholder && (
                  <div className="bg-muted-more-foreground animate-skeleton absolute top-0 left-0 size-full rounded-sm" />
                )}
              </div>
            </Button>
            <div className="relative flex min-h-9 min-w-0 flex-1 items-center justify-start pl-2">
              <ScrollArea
                className="max-h-[min(16rem,50vh)] w-full mask-[linear-gradient(to_bottom,transparent_0%,black_0.375rem,black_calc(100%-0.375rem),transparent_100%)]"
                classNameViewport="py-1.5"
              >
                <div className="flex w-full justify-start">
                  <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink px-px py-px pr-2 font-mono text-xs leading-normal wrap-anywhere whitespace-pre-wrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
                    {isPlaceholder || !variable || !isValueVisible ? (
                      <span>
                        {hiddenString}
                        {hasUnresolved && (
                          <>
                            <span className="hidden px-[0.5ch] lg:inline"> </span>
                            <br className="lg:hidden" />
                            <CircleAlertIcon
                              aria-label={unresolvedMessage}
                              className="text-warning mr-1.5 mb-0.5 inline-block size-3.25 shrink-0"
                            >
                              <title>{unresolvedMessage}</title>
                            </CircleAlertIcon>
                            <span className="text-warning">{unresolvedMessage}</span>
                          </>
                        )}
                      </span>
                    ) : isDynamic ? (
                      <RenderedValue parts={renderedParts} />
                    ) : (
                      variable.value
                    )}
                  </p>
                </div>
              </ScrollArea>
            </div>
            {variable?.staged && (
              <StagedChip staged={variable.staged} className="mr-1 hidden self-center sm:flex" />
            )}
            <div className="hidden sm:flex">
              {!hideThreeDotButton && (
                <ConditionalDropdownButton
                  {...placeholderOrVariableProps}
                  disableDelete={disableDelete}
                  disableEdit={disableEdit || isStagedDelete}
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
        <div className="absolute top-0.75 right-0.75 flex items-center gap-1 sm:hidden">
          {variable?.staged && <StagedChip staged={variable.staged} />}
          {!hideThreeDotButton && (
            <ConditionalDropdownButton
              {...placeholderOrVariableProps}
              disableDelete={disableDelete}
              disableEdit={disableEdit || isStagedDelete}
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

const stagedLabels: Record<NonNullable<TVariableWithStaged["staged"]>, string> = {
  new: "New",
  updated: "Changed",
  deleted: "Removed",
};

function StagedChip({
  staged,
  className,
}: {
  staged: NonNullable<TVariableWithStaged["staged"]>;
  className?: string;
}) {
  return (
    <div className={cn("bg-background shrink-0 rounded-sm", className)}>
      <p className="text-change dark:bg-change/12 dark:border-change/16 bg-change/14 border-change/18 truncate rounded-sm border px-1.5 py-0.5 text-xs font-medium">
        {stagedLabels[staged]}
      </p>
    </div>
  );
}

// Reference segments are colored so what came from where stays visible in the rendered text
function RenderedValue({ parts }: { parts: TRenderedPart[] }) {
  return parts.map((part, index) =>
    part.reference !== null ? (
      <span
        key={index}
        data-unresolved={!part.reference.resolved || undefined}
        className="text-process data-unresolved:text-foreground"
      >
        {part.value}
      </span>
    ) : (
      <span key={index}>{part.value}</span>
    ),
  );
}

function ConditionalDropdownButton({
  isPlaceholder,
  variable,
  disableEdit,
  disableDelete,
  setIsEditingVariable,
  className,
}: TVariableOrPlaceholderProps & {
  disableDelete?: boolean;
  disableEdit?: boolean;
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

  return (
    <ThreeDotButton
      variable={variable}
      setIsEditingVariable={setIsEditingVariable}
      className={className}
      disableEdit={disableEdit}
      disableDelete={disableDelete}
    />
  );
}

function ThreeDotButton({
  variable,
  setIsEditingVariable,
  disableDelete,
  disableEdit,
  className,
}: {
  variable: TVariableWithStaged;
  setIsEditingVariable: Dispatch<React.SetStateAction<boolean>>;
  disableDelete?: boolean;
  disableEdit?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { stage, discardStaged } = useVariables();
  const isLocked = disableDelete === true && disableEdit === true && !variable.staged;
  const isStagedDelete = variable.staged === "deleted";
  // A variable that only exists in the stage has nothing on the server to delete
  const canDelete = !isLocked && !isStagedDelete && variable.staged !== "new";

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            data-open={isOpen || undefined}
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
        }
      />
      <DropdownMenuContent
        data-locked={isLocked || undefined}
        className="z-50 w-44 data-locked:w-68"
        sideOffset={-1}
        data-open={isOpen || undefined}
        align="end"
        keepMounted
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
            {variable.staged && (
              <DropdownMenuItem onClick={() => discardStaged([variable.name])}>
                <Undo2Icon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">
                  {isStagedDelete ? "Restore" : "Discard"}
                </p>
              </DropdownMenuItem>
            )}
            {!isLocked && !isStagedDelete && (
              <DropdownMenuItem
                disabled={disableEdit}
                onClick={() => setIsEditingVariable((o) => !o)}
              >
                {!disableEdit ? (
                  <PenIcon className="-ml-0.5 size-5" />
                ) : (
                  <LockIcon className="-ml-0.5 size-5" />
                )}
                <p className="min-w-0 shrink leading-tight">Edit</p>
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                disabled={disableDelete}
                onClick={() => stage([{ name: variable.name, value: null }])}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                {!disableDelete ? (
                  <Trash2Icon className="-ml-0.5 size-5" />
                ) : (
                  <LockIcon className="-ml-0.5 size-5" />
                )}
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Edits in the readable form with the same reference editor the create form uses
function EditVariableForm({
  variable,
  variableTypeProps,
  setIsEditingVariable,
}: {
  variable: TVariableWithStaged;
  variableTypeProps: TEntityVariableTypeProps;
  setIsEditingVariable: Dispatch<React.SetStateAction<boolean>>;
}) {
  const { stage } = useVariables();
  const { tokens } = useVariableReferences();
  const referencesDisabled = variableTypeProps.type !== "service";
  const { language, icons } = useVariableReferenceLanguage(tokens);

  const [readableValue] = useState(() =>
    toReadableValue(variable.value, variable.references, readableTokenMap(tokens ?? [])),
  );
  const referencesByValue = useMemo(
    () => referenceMapForVariables(tokens ?? [], [variable]),
    [tokens, variable],
  );

  const [error, setError] = useState<Error | null>(null);

  const form = useAppForm({
    defaultValues: {
      variableValue: readableValue,
    },
    validators: {
      onChange: z.object({ variableValue: VariableForCreateValueSchema }),
    },
    onSubmit: async (d) => {
      const stored = toStoredValue(d.value.variableValue, referencesByValue);
      try {
        stage([{ name: variable.name, value: stored }]);
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Failed to stage the change"));
        return;
      }
      setIsEditingVariable(false);
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-1">
      {!referencesDisabled && <IconCache icons={icons} />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit(e);
        }}
        className="bg-background flex flex-1 items-start justify-start gap-1 rounded-lg"
      >
        <form.AppField
          name="variableValue"
          children={(field) => (
            <VariableValueField
              Field={field.TokenField}
              subField={field}
              language={language}
              referencesDisabled={referencesDisabled}
              compact
              placeholder="abc123"
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
