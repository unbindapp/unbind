"use client";

import ErrorLine from "@/components/error-line";
import { useService } from "@/components/service/service-provider";
import { useVariablesUtils } from "@/components/service/panel/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { defaultAnimationMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import {
  TVariableReferenceShallow,
  TVariableShallow,
  VariableForCreateValueSchema,
} from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import {
  CheckIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  PenIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { Dispatch, ReactNode, useRef, useState } from "react";
import { z } from "zod";

export type TVariableOrReferenceShallow =
  | ({ variable_type: "regular" } & TVariableShallow)
  | ({ variable_type: "reference" } & TVariableReferenceShallow);

type TProps =
  | {
      variable: TVariableOrReferenceShallow;
      isPlaceholder?: never;
    }
  | {
      isPlaceholder: true;
      variable?: never;
    };

export default function VariableCard({ variable, isPlaceholder }: TProps) {
  const [isValueVisible, setIsValueVisible] = useState(false);
  const [isEditingVariable, setIsEditingVariable] = useState(false);

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      data-value-visible={isValueVisible ? true : undefined}
      data-not-editing={!isEditingVariable ? true : undefined}
      className="data-not-editing:has-hover:hover:bg-background-hover group/card relative flex w-full flex-col rounded-xl border px-3 py-0.75 data-placeholder:text-transparent sm:flex-row sm:items-center sm:rounded-lg sm:pr-0.75"
    >
      <div className="flex h-9 w-full shrink-0 items-center py-2 pr-8 sm:w-56 sm:pr-4 md:w-64">
        <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden font-mono text-sm leading-none text-ellipsis whitespace-nowrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
          {isPlaceholder ? "Loading key" : variable.name}
        </p>
      </div>
      <div className="relative -ml-2 flex w-[calc(100%+1rem)] min-w-0 flex-1 items-center sm:mt-0 sm:w-auto">
        {(!variable || !isEditingVariable) && (
          <>
            <CopyButton variable={variable} isPlaceholder={isPlaceholder} />
            <Button
              data-visible={isValueVisible ? true : undefined}
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
            <div className="relative flex h-9 min-w-0 flex-1 items-center justify-start py-1 pl-2">
              <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden pr-2 font-mono text-xs leading-none text-ellipsis whitespace-nowrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
                {isPlaceholder || !isValueVisible ? "••••••••••" : variable.value}
              </p>
            </div>
            {isPlaceholder ? (
              <Button disabled fadeOnDisabled={false} variant="ghost" size="icon">
                <div className="bg-muted-more-foreground animate-skeleton hidden size-6 rounded-md sm:flex" />
              </Button>
            ) : (
              <ThreeDotButton
                variable={variable}
                setIsEditingVariable={setIsEditingVariable}
                className="hidden sm:flex"
              />
            )}
          </>
        )}
        {variable && isEditingVariable && (
          <EditVariableForm variable={variable} setIsEditingVariable={setIsEditingVariable} />
        )}
      </div>
      {(!isEditingVariable || !variable) && (
        <div className="absolute top-0.75 right-0.75 sm:hidden">
          {isPlaceholder ? (
            <Button disabled fadeOnDisabled={false} variant="ghost" size="icon">
              <div className="bg-muted-foreground animate-skeleton size-6 rounded-lg" />
            </Button>
          ) : (
            <ThreeDotButton
              className="rounded-lg"
              variable={variable}
              setIsEditingVariable={setIsEditingVariable}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ThreeDotButton({
  variable,
  setIsEditingVariable,
  className,
}: {
  variable: TVariableOrReferenceShallow;
  setIsEditingVariable: Dispatch<React.SetStateAction<boolean>>;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

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
          <EllipsisVerticalIcon className="size-6 transition-transform group-data-open/button:rotate-90" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="z-50 w-40"
        sideOffset={-1}
        data-open={isOpen ? true : undefined}
        align="end"
        forceMount={true}
      >
        <ScrollArea>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setIsEditingVariable((o) => !o)}>
              <PenIcon className="-ml-0.5 size-5" />
              <p className="min-w-0 shrink leading-tight">Edit</p>
            </DropdownMenuItem>
            <DeleteTrigger variable={variable} closeDropdown={() => setIsOpen(false)}>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <TrashIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditVariableForm({
  variable,
  setIsEditingVariable,
}: {
  variable: TVariableOrReferenceShallow;
  setIsEditingVariable: Dispatch<React.SetStateAction<boolean>>;
}) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { refetch } = useVariablesUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
    type: variable.variable_type === "reference" ? "service" : variable.type,
  });
  const { mutateAsync: upsertVariables, error } = api.variables.update.useMutation({
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
        teamId,
        projectId,
        environmentId,
        serviceId,
        type: variable.variable_type === "reference" ? "service" : variable.type,
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
              inputClassName="rounded-lg px-2.5 py-1.5 h-9 sm:rounded-md font-mono"
              infoClassName="pt-1 pb-0.5 text-xs"
            />
          )}
        />
        <form.Subscribe
          selector={(state) => [state.isSubmitting]}
          children={([isSubmitting]) => (
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
  closeDropdown,
  children,
}: {
  variable: TVariableOrReferenceShallow;
  closeDropdown: () => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { teamId, projectId, environmentId, serviceId } = useService();

  const { invalidate: invalidateVariables, optimisticRemove } = useVariablesUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
    type: "service",
  });

  const {
    mutate: deleteVariable,
    isPending,
    error,
    reset,
  } = api.variables.delete.useMutation({
    onSuccess: async () => {
      setIsOpen(false);
      optimisticRemove({
        variables: variable.variable_type === "reference" ? [] : [variable],
        variableReferences: variable.variable_type === "reference" ? [variable] : [],
      });
      invalidateVariables();
      closeDropdown();
    },
  });

  const timeout = useRef<NodeJS.Timeout | null>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          closeDropdown();
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            reset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Variable</DialogTitle>
          <p className="bg-border -mx-0.5 max-w-[calc(100%+0.25rem)] truncate rounded-md px-2 py-1 font-mono leading-tight font-medium">
            {variable.name}
          </p>
          <DialogDescription>
            Are you sure you want to delete this variable? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <ErrorLine message={error?.message} className="-mb-4" />}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose asChild className="text-muted-foreground">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={() =>
              deleteVariable({
                teamId,
                projectId,
                environmentId,
                serviceId,
                type: variable.variable_type === "reference" ? "service" : variable.type,
                variables: variable.variable_type === "reference" ? [] : [{ name: variable.name }],
                variableReferenceIds: variable.variable_type === "reference" ? [variable.id] : [],
              })
            }
            variant="destructive"
            isPending={isPending}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({
  variable,
  isPlaceholder,
}: {
  variable?: TVariableOrReferenceShallow;
  isPlaceholder?: boolean;
}) {
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();
  return (
    <Button
      data-copied={isRecentlyCopied ? true : undefined}
      onClick={isPlaceholder || !variable ? () => null : () => copyToClipboard(variable.value)}
      variant="ghost"
      forceMinSize="medium"
      size="icon"
      className="text-muted-more-foreground group/button rounded-lg group-data-placeholder/card:text-transparent sm:rounded-md"
      disabled={isPlaceholder}
      fadeOnDisabled={false}
    >
      <div className="relative size-4 transition-transform group-data-copied/button:rotate-90">
        <CopyIcon className="group-data-copied/button:text-success size-full transition-opacity group-data-copied/button:opacity-0" />
        <CheckIcon
          strokeWidth={3}
          className="group-data-copied/button:text-success absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-opacity group-data-copied/button:opacity-100"
        />
        {isPlaceholder && (
          <div className="bg-muted-more-foreground animate-skeleton absolute top-0 left-0 size-full rounded-sm" />
        )}
      </div>
    </Button>
  );
}
