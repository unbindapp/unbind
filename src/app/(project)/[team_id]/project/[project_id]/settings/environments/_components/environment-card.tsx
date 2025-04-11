"use client";

import ErrorLine from "@/components/error-line";
import { useProjectUtils } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
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
import {
  CreateEnvironmentFormNameSchema,
  environmentNameMaxLength,
  TEnvironmentShallow,
} from "@/server/trpc/api/environments/types";
import { api } from "@/server/trpc/setup/client";
import { EllipsisVerticalIcon, PenIcon, TrashIcon } from "lucide-react";
import { ReactNode, useRef, useState } from "react";
import { z } from "zod";

type TProps =
  | {
      isPlaceholder: true;
      environment?: never;
      teamId?: never;
      projectId?: never;
    }
  | {
      isPlaceholder?: never;
      environment: TEnvironmentShallow;
      teamId: string;
      projectId: string;
    };

export default function EnvironmentCard({ environment, teamId, projectId, isPlaceholder }: TProps) {
  return (
    <li className="relative w-full p-1 sm:w-1/2">
      <div
        data-pending={isPlaceholder ? true : undefined}
        className="group/item relative flex w-full items-center justify-start"
      >
        <Button
          disabled={isPlaceholder}
          fadeOnDisabled={false}
          variant="outline-muted"
          className="has-hover:group-hover/item:bg-background-hover flex w-full flex-row items-center justify-start py-3 pr-12 pl-4 font-medium"
        >
          <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
            {isPlaceholder ? "Loading" : environment.display_name}
          </p>
        </Button>
        <div className="absolute top-1/2 right-1.25 size-9 -translate-y-1/2">
          {isPlaceholder ? (
            <div className="flex size-full items-center justify-center">
              <div className="bg-muted-more-foreground animate-skeleton size-6 rounded-md" />
            </div>
          ) : (
            <ThreeDotButton
              className="size-full"
              environment={environment}
              teamId={teamId}
              projectId={projectId}
            />
          )}
        </div>
      </div>
    </li>
  );
}

function ThreeDotButton({
  environment,
  teamId,
  projectId,
  className,
}: {
  environment: TEnvironmentShallow;
  teamId: string;
  projectId: string;
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
            <RenameTrigger environment={environment} teamId={teamId} projectId={projectId}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <PenIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Rename</p>
              </DropdownMenuItem>
            </RenameTrigger>
            <DeleteTrigger environment={environment} teamId={teamId} projectId={projectId}>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
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

function DeleteTrigger({
  environment,
  teamId,
  projectId,
  children,
}: {
  environment: TEnvironmentShallow;
  teamId: string;
  projectId: string;
  children: ReactNode;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const textToConfirm = "Delete this environment permanently";
  const { asyncPush } = useAsyncPush();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });

  const {
    mutateAsync: deleteEnvironment,
    error,
    reset,
  } = api.environments.delete.useMutation({
    onSuccess: async () => {
      invalidateProjects();
    },
  });

  const form = useAppForm({
    defaultValues: {
      textToConfirm: "",
    },
    validators: {
      onChange: z
        .object({
          textToConfirm: z.string().refine((v) => v === textToConfirm, {
            message: "Please type the correct text to confirm",
          }),
        })
        .strip(),
    },
    onSubmit: async ({ formApi }) => {
      await deleteEnvironment({ id: environment.id, teamId, projectId });
      formApi.reset();
    },
  });

  const timeout = useRef<NodeJS.Timeout>(undefined);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) {
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            form.reset();
            reset();
          }, 200);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Delete Environment</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this environment? This action cannot be undone. All the
            services inside this environment will be permanently deleted.
            <br />
            <br />
            Type {`"`}
            <span className="text-destructive font-semibold">{textToConfirm}</span>
            {`"`} to confirm.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="mt-2 flex flex-col"
        >
          <form.AppField
            name="textToConfirm"
            children={(field) => (
              <field.TextField
                hideInfo
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder={textToConfirm}
              />
            )}
          />
          {error && <ErrorLine message={error?.message} className="mt-4" />}
          <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting, state.values]}
              children={([canSubmit, isSubmitting, values]) => (
                <form.SubmitButton
                  data-submitting={isSubmitting ? true : undefined}
                  variant="destructive"
                  disabled={
                    !canSubmit ||
                    (typeof values === "object" && values.textToConfirm !== textToConfirm)
                  }
                  isPending={isSubmitting ? true : false}
                >
                  Delete
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameTrigger({
  environment,
  teamId,
  projectId,
  children,
}: {
  environment: TEnvironmentShallow;
  teamId: string;
  projectId: string;
  children: ReactNode;
}) {
  const {
    mutateAsync: updateEnvironment,
    error: updateEnvironmentError,
    reset: updateEnvironmentReset,
  } = api.environments.update.useMutation();
  const { asyncPush } = useAsyncPush();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });
  const { invalidate: invalidateProject } = useProjectUtils({ teamId, projectId });

  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: z
        .object({
          name: CreateEnvironmentFormNameSchema,
        })
        .strip(),
    },
    onSubmit: async ({ formApi, value }) => {
      const res = await updateEnvironment({
        id: environment.id,
        displayName: value.name,
        teamId,
        projectId,
      });

      const environmentId = res.data.id;
      invalidateProject();
      invalidateProjects();

      setOpen(false);

      formApi.reset();
    },
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            form.reset();
            updateEnvironmentReset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Rename Environment</DialogTitle>
          <DialogDescription>Give a new name to the environment.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="mt-2 flex flex-col"
        >
          <form.AppField
            name="name"
            children={(field) => (
              <field.TextField
                autoCapitalize="none"
                dontCheckUntilSubmit
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder={"staging"}
                maxLength={environmentNameMaxLength}
              />
            )}
          />
          {updateEnvironmentError && (
            <ErrorLine message={updateEnvironmentError?.message} className="mt-4" />
          )}
          <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => [state.isSubmitting]}
              children={([isSubmitting]) => (
                <form.SubmitButton
                  data-submitting={isSubmitting ? true : undefined}
                  isPending={isSubmitting ? true : false}
                >
                  Rename
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
