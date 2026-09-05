"use client";

import { useEnvironments } from "@/components/environment/environments-provider";
import ErrorLine from "@/components/error-line";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
import { Button, LinkButton } from "@/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  TDialogHandle,
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
  createEnvironment as createEnvironmentFn,
  deleteEnvironment as deleteEnvironmentFn,
  environmentNameMaxLength,
  EnvironmentNameSchema,
  EnvironmentRenameSchema,
  TEnvironmentShallow,
  updateEnvironment as updateEnvironmentFn,
} from "@/lib/queries/environments";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { CheckIcon, EllipsisVerticalIcon, PenIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { ReactElement, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { z } from "zod";

type TProps =
  | {
      isPlaceholder: true;
      environment?: never;
      teamId?: never;
      projectId?: never;
      isSelected?: never;
      onClick?: never;
      disableDelete?: never;
    }
  | {
      isPlaceholder?: never;
      environment: TEnvironmentShallow;
      teamId: string;
      projectId: string;
      isSelected: boolean;
      onClick: () => void;
      disableDelete?: boolean;
    };

export default function EnvironmentCard({
  environment,
  teamId,
  projectId,
  isPlaceholder,
  isSelected,
  onClick,
  disableDelete,
}: TProps) {
  return (
    <li className="relative w-full p-1 sm:w-1/2">
      <div
        data-pending={isPlaceholder || undefined}
        className="group/item relative flex w-full items-center justify-start"
      >
        <LinkButton
          disabled={isPlaceholder}
          fadeOnDisabled={false}
          variant="outline"
          to={"."}
          search={(prev) => ({ ...prev, environment: environment?.id })}
          onClick={onClick}
          className="flex w-full flex-row items-center justify-start gap-2.5 py-3 pr-12 pl-4 font-medium"
        >
          {environment && <NewEntityIndicator id={environment.id} />}
          {isSelected && (
            <div className="bg-foreground text-background -ml-0.75 flex size-4 items-center justify-center rounded-full p-0.75">
              <CheckIcon className="size-full" strokeWidth={4} />
            </div>
          )}
          <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
            {isPlaceholder ? "Loading" : environment.name}
          </p>
        </LinkButton>
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
              disableDelete={disableDelete}
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
  disableDelete,
  className,
}: {
  environment: TEnvironmentShallow;
  teamId: string;
  projectId: string;
  disableDelete?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [renameHandle] = useState(() => createDialogHandle());
  const [deleteHandle] = useState(() => createDialogHandle());

  return (
    <>
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
              <EllipsisVerticalIcon className="size-6 transition-transform group-data-open/button:rotate-90" />
            </Button>
          }
        />
        <DropdownMenuContent
          className="z-50 w-40"
          sideOffset={-1}
          data-open={isOpen || undefined}
          align="end"
          keepMounted
        >
          <ScrollArea>
            <DropdownMenuGroup>
              {/* The dialogs live outside the menu; nested inside the open modal menu they would be inert */}
              <DialogTrigger
                nativeButton={false}
                handle={renameHandle}
                render={
                  <DropdownMenuItem>
                    <PenIcon className="-ml-0.5 size-5" />
                    <p className="min-w-0 shrink leading-tight">Rename</p>
                  </DropdownMenuItem>
                }
              />
              {!disableDelete && (
                <DialogTrigger
                  nativeButton={false}
                  handle={deleteHandle}
                  render={
                    <DropdownMenuItem className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive">
                      <Trash2Icon className="-ml-0.5 size-5" />
                      <p className="min-w-0 shrink leading-tight">Delete</p>
                    </DropdownMenuItem>
                  }
                />
              )}
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameTrigger
        environment={environment}
        teamId={teamId}
        projectId={projectId}
        handle={renameHandle}
      />
      {!disableDelete && (
        <DeleteTrigger
          environment={environment}
          teamId={teamId}
          projectId={projectId}
          handle={deleteHandle}
        />
      )}
    </>
  );
}

function DeleteTrigger({
  environment,
  teamId,
  projectId,
  handle,
  children,
}: {
  environment: TEnvironmentShallow;
  teamId: string;
  projectId: string;
  handle?: TDialogHandle;
  children?: ReactElement;
}) {
  const router = useRouter();
  const { environmentId } = useIdsFromPathname();

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
  } = useMutation({
    mutationFn: deleteEnvironmentFn,
    onSuccess: async () => {
      invalidateProject();
      invalidateProjects();
    },
  });

  return (
    <DeleteEntityTrigger
      dialogTitle="Delete Environment"
      dialogDescription="Are you sure you want to delete this environment? This action cannot be undone. All the services inside this environment will be permanently deleted."
      error={deleteEnvironmentError}
      deletingEntityName={environment.name}
      handle={handle}
      onDialogClose={() => {
        deleteEnvironmentReset();
      }}
      onSubmit={async () => {
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
            router.navigate({
              to: ".",
              search: (prev) => ({ ...prev, environment: environmentIdToNavigateTo ?? undefined }),
            }),
            () => new Error("Failed to navigate to environments"),
          );

          if (navigateRes.isErr()) {
            toast.add({
              type: "error",
              title: "Failed to navigate",
              description: navigateRes.error.message,
            });
          }
        } else {
          const invalidateRes = await ResultAsync.fromPromise(
            invalidateEnvironments(),
            () => new Error("Failed to fetch environments"),
          );

          if (invalidateRes.isErr()) {
            toast.add({
              type: "error",
              title: "Failed to fetch environments",
              description: invalidateRes.error.message,
            });
          }
        }
      }}
    >
      {children}
    </DeleteEntityTrigger>
  );
}

function RenameTrigger({
  environment,
  teamId,
  projectId,
  handle,
  children,
}: {
  environment: TEnvironmentShallow;
  teamId: string;
  projectId: string;
  handle?: TDialogHandle;
  children?: ReactElement;
}) {
  const {
    mutateAsync: updateEnvironment,
    error: updateEnvironmentError,
    reset: updateEnvironmentReset,
  } = useMutation({
    mutationFn: updateEnvironmentFn,
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

  return (
    <RenameEntityTrigger
      type="name-and-description"
      name={environment.name}
      description={environment.description}
      nameInputTitle="Environment Name"
      descriptionInputTitle="Environment Description"
      dialogTitle="Rename Environment"
      dialogDescription="Give a new name and description to the environment."
      error={updateEnvironmentError}
      formSchema={EnvironmentRenameSchema}
      handle={handle}
      onDialogClose={() => {
        updateEnvironmentReset();
      }}
      onSubmit={async (value) => {
        await updateEnvironment({
          id: environment.id,
          name: value.name,
          description: value.description,
          teamId,
          projectId,
        });

        const invalidateRes = await ResultAsync.fromPromise(
          invalidateEnvironments(),
          () => new Error("Failed to fetch environments"),
        );

        if (invalidateRes.isErr()) {
          toast.add({
            type: "error",
            title: "Failed to fetch environments",
            description: invalidateRes.error.message,
          });
        }
      }}
    >
      {children}
    </RenameEntityTrigger>
  );
}

export function NewEnvironmentCard({ teamId, projectId }: { teamId: string; projectId: string }) {
  const {
    mutateAsync: createEnvironment,
    error: createEnvironmentError,
    reset: createEnvironmentReset,
  } = useMutation({
    mutationFn: createEnvironmentFn,
    onSuccess: () => {
      invalidateProject();
      invalidateProjects();
    },
  });
  const router = useRouter();

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

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
          name: EnvironmentNameSchema,
        })
        .strip(),
    },
    onSubmit: async ({ formApi, value }) => {
      const res = await createEnvironment({
        name: value.name,
        description: "",
        teamId,
        projectId,
      });

      temporarilyAddNewEntity(res.data.id);

      const newEnvironmentId = res.data.id;

      const invalidateRes = await ResultAsync.fromPromise(
        invalidateEnvironments(),
        () => new Error("Failed to fetch environments"),
      );

      if (invalidateRes.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to fetch environments",
          description: invalidateRes.error.message,
        });
      }

      const navigateRes = await ResultAsync.fromPromise(
        router.navigate({
          to: ".",
          search: (prev) => ({ ...prev, environment: newEnvironmentId }),
        }),
        () => new Error("Failed to navigate to environments"),
      );
      if (navigateRes.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to navigate",
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
      <li className="relative w-full p-1 sm:w-1/2">
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="text-muted-foreground flex w-full flex-row items-center justify-start px-4 py-3 font-medium"
            >
              <PlusIcon className="-my-1 -ml-1 size-4.5 shrink-0" />
              <p className="min-w-0 shrink truncate leading-tight">New Environment</p>
            </Button>
          }
        />
      </li>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Create Environment</DialogTitle>
          <DialogDescription>Give a name to the new environment.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit(e);
          }}
          className="flex w-full flex-col gap-4"
        >
          <div className="flex w-full flex-col gap-2">
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
          </div>
          {createEnvironmentError && <ErrorLine message={createEnvironmentError?.message} />}
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose
              className="text-muted-foreground"
              render={
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              }
            />
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={({ isSubmitting }) => (
                <form.SubmitButton
                  data-submitting={isSubmitting || undefined}
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
