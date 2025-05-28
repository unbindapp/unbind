"use client";

import {
  CreateEnvironmentDialog,
  TCreateEnvironmentDialogProps,
} from "@/components/environment/create-environment-dialog";
import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbSeparator, BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useProjects, useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";
import { ResultAsync } from "neverthrow";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type TProps = {
  className?: string;
};

export default function ProjectBreadcrumb({ className }: TProps) {
  const { asyncPush } = useAsyncPush();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    teamId: teamIdFromPathname,
    projectId: projectIdFromPathname,
    environmentId: environmentIdFromPathname,
  } = useIdsFromPathname();

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

  const onProjectIdHover = useCallback(
    (id: string) => {
      const href = getHrefForProjectId(id);
      if (!href) return;
      console.log("prefetching", href);
      router.prefetch(href);
    },
    [getHrefForProjectId, router],
  );

  const getHrefForEnvironmentId = useCallback(
    (id: string) => {
      const project = projectsData?.projects.find((p) => p.id === selectedProjectId);
      const environment = project?.environments.find((e) => e.id === id);
      if (!project || !environment) return null;
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("environment", environment.id);
      return newUrl.toString();
    },
    [projectsData, selectedProjectId],
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

  const onEnvironmentIdHover = useCallback(
    (id: string) => {
      const href = getHrefForEnvironmentId(id);
      if (!href) return;
      router.prefetch(href);
    },
    [getHrefForEnvironmentId, router],
  );

  const getHrefForEnvironmentManageItem = useCallback(() => {
    return `/${teamIdFromPathname}/project/${selectedProjectId}/settings/environments?environment=${environmentIdFromPathname || selectedEnvironmentId}`;
  }, [teamIdFromPathname, selectedProjectId, environmentIdFromPathname, selectedEnvironmentId]);

  const onSelectEnvironmentManageItem = useCallback(
    () => asyncPush(getHrefForEnvironmentManageItem()),
    [getHrefForEnvironmentManageItem, asyncPush],
  );

  const onHoverEnvironmentManageItem = useCallback(() => {
    const href = getHrefForEnvironmentManageItem();
    if (!href) return;
    router.prefetch(href);
  }, [getHrefForEnvironmentManageItem, router]);

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
        dialogOnOpenChange={(o) => {
          if (!o) setIsEnvironmentsMenuOpen(false);
        }}
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
        onHover={onProjectIdHover}
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
        onHover={onEnvironmentIdHover}
        newItemTitle="New Environment"
        newItemIsPending={false}
        NewItemWrapper={CreateEnvironmentDialogMemoized}
        newItemDontCloseMenuOnSelect={true}
        onSelectNewItem={() => null}
        manageItemTitle="Manage Environments"
        onSelectManageItem={onSelectEnvironmentManageItem}
        onHoverManageItem={onHoverEnvironmentManageItem}
      />
    </BreadcrumbWrapper>
  );
}
