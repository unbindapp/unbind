"use client";

import { useEnvironments } from "@/components/environment/environments-provider";
import ErrorLine from "@/components/error-line";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
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
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  CreateEnvironmentFormNameSchema,
  environmentNameMaxLength,
  TEnvironmentShallow,
} from "@/server/trpc/api/environments/types";
import { api } from "@/server/trpc/setup/client";
import { CheckIcon, EllipsisVerticalIcon, PenIcon, PlusIcon, TrashIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

type TProps =
  | {
      isPlaceholder: true;
      environment?: never;
      teamId?: never;
      projectId?: never;
      isSelected?: never;
      onClick?: never;
    }
  | {
      isPlaceholder?: never;
      environment: TEnvironmentShallow;
      teamId: string;
      projectId: string;
      isSelected: boolean;
      onClick: () => void;
    };

export default function EnvironmentCard({
  environment,
  teamId,
  projectId,
  isPlaceholder,
  isSelected,
  onClick: onClickProp,
}: TProps) {
  const { asyncPush } = useAsyncPush();

  return (
    <li className="relative w-full p-1 sm:w-1/2">
      <div
        data-pending={isPlaceholder ? true : undefined}
        className="group/item relative flex w-full items-center justify-start"
      >
        <Button
          disabled={isPlaceholder}
          fadeOnDisabled={false}
          variant="outline"
          onClick={() => {
            if (!environment) return;
            onClickProp?.();
            asyncPush(
              `/${teamId}/project/${projectId}/settings/environments?environment=${environment?.id}`,
            );
          }}
          className="has-hover:group-hover/item:bg-border flex w-full flex-row items-center justify-start gap-2.5 py-3 pr-12 pl-4 font-medium"
        >
          {isSelected && (
            <div className="bg-foreground text-background -ml-0.75 flex size-4 items-center justify-center rounded-full p-0.75">
              <CheckIcon className="size-full" strokeWidth={4} />
            </div>
          )}
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
            "text-muted-more-foreground has-hover:hover:bg-foreground/8 active:bg-foreground/8 group/button rounded-md group-data-placeholder/card:text-transparent",
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
            <RenameTrigger
              environment={environment}
              teamId={teamId}
              projectId={projectId}
              closeDropdown={() => setIsOpen(false)}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <PenIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Rename</p>
              </DropdownMenuItem>
            </RenameTrigger>
            <DeleteTrigger
              environment={environment}
              teamId={teamId}
              projectId={projectId}
              closeDropdown={() => setIsOpen(false)}
            >
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

function DeleteTrigger({
  environment,
  teamId,
  projectId,
  closeDropdown,
  children,
}: {
  environment: TEnvironmentShallow;
  teamId: string;
  projectId: string;
  closeDropdown: () => void;
  children: ReactNode;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { asyncPush } = useAsyncPush();
  const { environmentId } = useIdsFromPathname();

  const textToConfirm = `Delete ${environment.display_name} permanently`;

  const {
    query: { data: projectsData },
  } = useProject();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });
  const { invalidate: invalidateProject } = useProjectUtils({ teamId, projectId });
  const {
    utils: { invalidate: invalidateEnvironments },
  } = useEnvironments();

  const {
    mutateAsync: deleteEnvironment,
    error: deleteEnvironmentError,
    reset: deleteEnvironmentReset,
  } = api.environments.delete.useMutation({
    onSuccess: async () => {
      invalidateProject();
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
      const deletingCurrentEnv = environmentId === environment.id;
      const currentEnvironmentId = environment.id;

      await deleteEnvironment({ id: environment.id, teamId, projectId });
      if (deletingCurrentEnv) {
        invalidateEnvironments();
        const environments = projectsData?.project.environments;
        const defaultEnvironmentId = projectsData?.project.default_environment_id;
        const filteredEnvironments = environments?.filter((e) => e.id !== currentEnvironmentId);

        const environmentIdToNavigateTo =
          defaultEnvironmentId && currentEnvironmentId !== defaultEnvironmentId
            ? defaultEnvironmentId
            : filteredEnvironments && filteredEnvironments?.length >= 1
              ? filteredEnvironments[0].id
              : null;

        const navigateRes = await ResultAsync.fromPromise(
          asyncPush(
            `/${teamId}/project/${projectId}/settings/environments${environmentIdToNavigateTo ? `?environment=${environmentIdToNavigateTo}` : ""}`,
          ),
          () => new Error("Failed to navigate to environments"),
        );

        if (navigateRes.isErr()) {
          toast.error("Failed to navigate", {
            description: navigateRes.error.message,
          });
        }
      } else {
        const invalidateRes = await ResultAsync.fromPromise(
          invalidateEnvironments(),
          () => new Error("Failed to fetch environments"),
        );

        if (invalidateRes.isErr()) {
          toast.error("Failed to fetch environments", {
            description: invalidateRes.error.message,
          });
        }
      }
      formApi.reset();
      closeDropdown();
    },
  });

  const timeout = useRef<NodeJS.Timeout>(undefined);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) {
          closeDropdown();
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            form.reset();
            deleteEnvironmentReset();
          }, defaultAnimationMs);
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
          className="flex flex-col"
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
          {deleteEnvironmentError && (
            <ErrorLine message={deleteEnvironmentError?.message} className="mt-4" />
          )}
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
  closeDropdown,
  children,
}: {
  environment: TEnvironmentShallow;
  teamId: string;
  projectId: string;
  closeDropdown: () => void;
  children: ReactNode;
}) {
  const {
    mutateAsync: updateEnvironment,
    error: updateEnvironmentError,
    reset: updateEnvironmentReset,
  } = api.environments.update.useMutation({
    onSuccess: () => {
      invalidateProject();
      invalidateProjects();
    },
  });

  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });
  const { invalidate: invalidateProject } = useProjectUtils({ teamId, projectId });
  const {
    utils: { invalidate: invalidateEnvironments },
  } = useEnvironments();

  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: environment.display_name,
    },
    validators: {
      onChange: z
        .object({
          name: CreateEnvironmentFormNameSchema,
        })
        .strip(),
    },
    onSubmit: async ({ formApi, value }) => {
      await updateEnvironment({
        id: environment.id,
        displayName: value.name,
        teamId,
        projectId,
      });

      const invalidateRes = await ResultAsync.fromPromise(
        invalidateEnvironments(),
        () => new Error("Failed to fetch environments"),
      );

      if (invalidateRes.isErr()) {
        toast.error("Failed to fetch environments", {
          description: invalidateRes.error.message,
        });
      }

      setOpen(false);
      formApi.reset();
      closeDropdown();
    },
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          closeDropdown();
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
          className="flex flex-col"
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
                placeholder={"development"}
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

export function NewEnvironmentCard({ teamId, projectId }: { teamId: string; projectId: string }) {
  const {
    mutateAsync: createEnvironment,
    error: createEnvironmentError,
    reset: createEnvironmentReset,
  } = api.environments.create.useMutation({
    onSuccess: () => {
      invalidateProject();
      invalidateProjects();
    },
  });
  const { asyncPush } = useAsyncPush();

  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });
  const { invalidate: invalidateProject } = useProjectUtils({ teamId, projectId });
  const {
    utils: { invalidate: invalidateEnvironments },
  } = useEnvironments();

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
      const res = await createEnvironment({
        displayName: value.name,
        teamId,
        projectId,
      });

      const newEnvironmentId = res.data.id;

      const invalidateRes = await ResultAsync.fromPromise(
        invalidateEnvironments(),
        () => new Error("Failed to fetch environments"),
      );

      if (invalidateRes.isErr()) {
        toast.error("Failed to fetch environments", {
          description: invalidateRes.error.message,
        });
      }

      const navigateRes = await ResultAsync.fromPromise(
        asyncPush(
          `/${teamId}/project/${projectId}/settings/environments?environment=${newEnvironmentId}`,
        ),
        () => new Error("Failed to navigate to environments"),
      );
      if (navigateRes.isErr()) {
        toast.error("Failed to navigate", {
          description: navigateRes.error.message,
        });
      }

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
            createEnvironmentReset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>
        <li className="relative w-full p-1 sm:w-1/2">
          <div className="group/item relative flex w-full items-center justify-start">
            <Button
              variant="outline"
              className="text-muted-foreground flex w-full flex-row items-center justify-start px-4 py-3 font-medium"
            >
              <PlusIcon className="-my-1 -ml-1 size-4.5 shrink-0" />
              <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
                New Environment
              </p>
            </Button>
          </div>
        </li>
      </DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Create Environment</DialogTitle>
          <DialogDescription>Give a name to the new environment.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col"
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
                placeholder={"development"}
                maxLength={environmentNameMaxLength}
              />
            )}
          />
          {createEnvironmentError && (
            <ErrorLine message={createEnvironmentError?.message} className="mt-4" />
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
                  Create
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
