"use client";

import { useProjects, useProjectsUtils } from "@/components/project/projects-provider";
import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbSeparator, BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ButtonHTMLAttributes,
  cloneElement,
  isValidElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { ResultAsync } from "neverthrow";
import { api } from "@/server/trpc/setup/client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ErrorLine from "@/components/error-line";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { z } from "zod";
import {
  CreateEnvironmentFormNameSchema,
  environmentNameMaxLength,
} from "@/server/trpc/api/environments/types";
import { Button } from "@/components/ui/button";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
import { defaultAnimationMs } from "@/lib/constants";

type TProps = {
  className?: string;
};

export default function ProjectBreadcrumb({ className }: TProps) {
  const { asyncPush } = useAsyncPush();
  const {
    teamId: teamIdFromPathname,
    projectId: projectIdFromPathname,
    environmentId: environmentIdFromPathname,
  } = useIdsFromPathname();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: projectsData } = useProjects();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId: teamIdFromPathname || "" });

  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromPathname);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(environmentIdFromPathname);

  const [isProjectsMenuOpen, setIsProjectsMenuOpen] = useState(false);
  const [isEnvironmentsMenuOpen, setIsEnvironmentsMenuOpen] = useState(false);

  useEffect(() => {
    setSelectedProjectId(projectIdFromPathname);
  }, [projectIdFromPathname, projectsData]);

  useEffect(() => {
    setSelectedEnvironmentId(environmentIdFromPathname);
  }, [environmentIdFromPathname]);

  const selectedProject = selectedProjectId
    ? projectsData?.projects.find((p) => p.id === selectedProjectId)
    : undefined;

  const selectedEnvironment = selectedProject?.environments.find(
    (e) => e.id === selectedEnvironmentId,
  );

  const getHrefForProjectId = useCallback(
    (id: string) => {
      const project = projectsData?.projects.find((p) => p.id === id);
      const environments = project?.environments;
      if (!environments || environments.length < 1) return null;
      const environment = project.default_environment_id
        ? project.environments.find((e) => e.id === project.default_environment_id)
        : environments[0];
      if (!project || !environment || !teamIdFromPathname) return null;
      return `/${teamIdFromPathname}/project/${project.id}?environment=${environment.id}`;
    },
    [projectsData, teamIdFromPathname],
  );

  const onProjectIdSelect = useCallback(
    async (id: string) => {
      setSelectedProjectId(id);
      const href = getHrefForProjectId(id);
      if (!href) return;
      await asyncPush(href);
    },
    [getHrefForProjectId, asyncPush],
  );

  const getHrefForEnvironmentId = useCallback(
    (id: string) => {
      const project = projectsData?.projects.find((p) => p.id === selectedProjectId);
      const environment = project?.environments.find((e) => e.id === id);
      if (!project || !environment || !teamIdFromPathname) return null;
      return `/${teamIdFromPathname}/project/${project.id}?environment=${environment.id}`;
    },
    [projectsData, selectedProjectId, teamIdFromPathname],
  );

  const onEnvironmentIdSelect = useCallback(
    async (id: string) => {
      setSelectedEnvironmentId(id);
      const href = getHrefForEnvironmentId(id);
      if (!href) return;
      await asyncPush(href);
    },
    [getHrefForEnvironmentId, asyncPush],
  );

  const { mutate: createProject, isPending: isPendingCreateProject } =
    api.projects.create.useMutation({
      onSuccess: async (res) => {
        const projectId = res.data?.id;
        const environments = res.data.environments;
        if (environments.length < 1) {
          toast.error("No environments found", {
            description: "There is no environment in this project",
          });
          return;
        }
        const environmentId = res.data.default_environment_id || environments[0].id;
        if (!projectId || !environmentId) {
          toast.error("Project or environment ID is missing", {
            description: "Project ID or Environment ID is missing",
          });
          return;
        }

        setIsProjectsMenuOpen(false);
        invalidateProjects();

        const asyncPushRes = await ResultAsync.fromPromise(
          asyncPush(`/${teamIdFromPathname}/project/${projectId}?environment=${environmentId}`),
          () => new Error("Failed to navigate to project"),
        );

        if (asyncPushRes.isErr()) {
          toast.error("Failed to navigate to project", {
            description: asyncPushRes.error.message,
          });
        }
      },
      onError: (error) => {
        toast.error("Failed to create project", {
          description: error.message,
        });
      },
    });

  const CreateEnvironmentDialogMemoized: (
    props: Omit<TCreateEnvironmentDialogProps, "onFormSubmitSuccessful">,
  ) => ReactNode = useCallback(
    (props) => (
      <CreateEnvironmentDialog
        {...props}
        onFormSubmitSuccessful={() => setIsEnvironmentsMenuOpen(false)}
      />
    ),
    [],
  );

  return (
    <BreadcrumbWrapper className={className}>
      <BreadcrumbItem
        flipChevronOnSm
        title="Projects"
        selectedItem={selectedProject}
        items={projectsData?.projects}
        open={isProjectsMenuOpen}
        setOpen={setIsProjectsMenuOpen}
        onSelect={onProjectIdSelect}
        newItemTitle="New Project"
        newItemIsPending={isPendingCreateProject}
        newItemDontCloseMenuOnSelect={true}
        onSelectNewItem={() => {
          if (!teamIdFromPathname) return;
          createProject({
            teamId: teamIdFromPathname,
          });
        }}
        showArrow={(project) => {
          const href = getHrefForProjectId(project.id);
          const params = searchParams.toString();
          const searchParamsStr = params ? `?${params}` : "";
          return href !== null && href !== pathname + searchParamsStr;
        }}
      />
      <BreadcrumbSeparator />
      <BreadcrumbItem
        flipChevronOnSm
        title="Environments"
        selectedItem={selectedEnvironment}
        items={selectedProject?.environments}
        open={isEnvironmentsMenuOpen}
        setOpen={setIsEnvironmentsMenuOpen}
        onSelect={onEnvironmentIdSelect}
        newItemTitle="New Environment"
        newItemIsPending={false}
        NewItemWrapper={CreateEnvironmentDialogMemoized}
        newItemDontCloseMenuOnSelect={true}
        onSelectNewItem={() => null}
      />
    </BreadcrumbWrapper>
  );
}

type TCreateEnvironmentDialogProps = {
  children: ReactNode;
  onFormSubmitSuccessful: () => void;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function CreateEnvironmentDialog({
  children,
  onFormSubmitSuccessful,
  ...rest
}: TCreateEnvironmentDialogProps) {
  const { teamId, projectId } = useProject();
  const {
    mutateAsync: createEnvironment,
    error: createEnvironmentError,
    reset: createEnvironmentReset,
  } = api.environments.create.useMutation();
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
      const res = await createEnvironment({
        displayName: value.name,
        teamId,
        projectId,
      });

      const environmentId = res.data.id;
      invalidateProject();
      invalidateProjects();

      setOpen(false);
      onFormSubmitSuccessful();

      const asyncPushRes = await ResultAsync.fromPromise(
        asyncPush(`/${teamId}/project/${projectId}?environment=${environmentId}`),
        () => new Error("Failed to navigate to project"),
      );
      if (asyncPushRes.isErr()) {
        toast.error("Failed to navigate to project", {
          description: asyncPushRes.error.message,
        });
        return;
      }

      formApi.reset();
    },
  });

  const childrenWithRestProps = useMemo(
    () => (isValidElement(children) ? cloneElement(children, { ...rest }) : children),
    [children, rest],
  );

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
      <DialogTrigger asChild>{childrenWithRestProps}</DialogTrigger>
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
          className="mt-2 flex flex-col"
        >
          <form.AppField
            name="name"
            children={(field) => (
              <field.TextField
                dontCheckUntilSubmit
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder="staging"
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
