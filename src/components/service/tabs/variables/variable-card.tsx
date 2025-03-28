"use client";

import ErrorLine from "@/components/error-line";
import { useService } from "@/components/service/service-provider";
import { useVariablesUtils } from "@/components/service/tabs/variables/variables-provider";
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
import { defaultAnimationMs } from "@/lib/constants";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import { TVariableShallow } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import {
  CheckIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  PenIcon,
  TrashIcon,
} from "lucide-react";
import { ReactNode, useRef, useState } from "react";

type TProps =
  | {
      variable: TVariableShallow;
      isPlaceholder?: never;
    }
  | {
      isPlaceholder: true;
      variable?: never;
    };

export default function VariableCard({ variable, isPlaceholder }: TProps) {
  const [isValueVisible, setIsValueVisible] = useState(false);
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      data-value-visible={isValueVisible ? true : undefined}
      className="has-hover:hover:bg-background-hover group/card relative flex w-full flex-col rounded-xl border px-3 py-0.75 font-mono data-placeholder:text-transparent sm:flex-row sm:items-center sm:rounded-lg"
    >
      <div className="flex w-full shrink-0 py-2 pr-8 sm:w-56 sm:pr-4 md:w-64">
        <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden text-sm leading-none text-ellipsis whitespace-nowrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
          {isPlaceholder ? "Loading key" : variable.name}
        </p>
      </div>
      <div className="flex w-full min-w-0 flex-1 items-center sm:mt-0 sm:w-auto">
        <Button
          data-copied={isRecentlyCopied ? true : undefined}
          onClick={isPlaceholder ? () => null : () => copyToClipboard(variable.value)}
          variant="ghost"
          forceMinSize="medium"
          size="icon"
          className="text-muted-more-foreground group/button -ml-2 rounded-md group-data-placeholder/card:text-transparent"
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
        <Button
          data-visible={isValueVisible ? true : undefined}
          onClick={() => setIsValueVisible((prev) => !prev)}
          variant="ghost"
          forceMinSize="medium"
          size="icon"
          className="text-muted-more-foreground group/button rounded-md group-data-placeholder/card:text-transparent"
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
        <div className="flex min-w-0 shrink py-1 pl-2">
          <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden text-xs leading-none text-ellipsis whitespace-nowrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
            {isPlaceholder || !isValueVisible ? "••••••••••" : variable.value}
          </p>
        </div>
        <div className="absolute top-1 right-1 ml-auto pl-1 sm:relative sm:top-auto sm:right-auto sm:-mr-2.25">
          {isPlaceholder ? (
            <Button disabled fadeOnDisabled={false} variant="ghost" size="icon">
              <div className="bg-muted-foreground animate-skeleton size-6 rounded-md" />
            </Button>
          ) : (
            <ThreeDotButton variable={variable} />
          )}
        </div>
      </div>
    </div>
  );
}

function ThreeDotButton({ variable }: { variable: TVariableShallow }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isOpen ? true : undefined}
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className="text-muted-more-foreground group/button rounded-md group-data-placeholder/card:text-transparent"
        >
          <EllipsisVerticalIcon className="size-6 transition-transform group-data-open/button:rotate-90" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="z-50"
        sideOffset={-1}
        data-open={isOpen ? true : undefined}
        align="end"
        forceMount={true}
      >
        <ScrollArea>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <PenIcon className="size-4" />
              <p className="min-w-0 shrink leading-tight">Edit</p>
            </DropdownMenuItem>
            <DeleteTrigger variable={variable} closeDropdown={() => setIsOpen(false)}>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <TrashIcon className="size-4" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteTrigger({
  variable,
  closeDropdown,
  children,
}: {
  variable: TVariableShallow;
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
    onSuccess: async (d) => {
      setIsOpen(false);
      optimisticRemove([variable]);
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
      <DialogContent hideXButton className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Delete Variable:{" "}
            <span className="bg-border rounded-md px-1.5 py-0.5 font-mono">{variable.name}</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this variable? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <ErrorLine message={error?.message} className="-mb-4" />}
        <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
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
                // @ts-expect-error | TODO: GO API should fix the types
                type: variable.type,
                variables: [{ name: variable.name }],
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
