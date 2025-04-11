"use client";

import { useProjects, useProjectsUtils } from "@/components/project/projects-provider";
import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbSeparator, BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ResultAsync } from "neverthrow";
import { api } from "@/server/trpc/setup/client";

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

  const [isProjectMenuOpen, setIsProjectsMenuOpen] = useState(false);
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

        const asyncPushRes = await ResultAsync.fromPromise(
          asyncPush(`/${teamIdFromPathname}/project/${projectId}?environment=${environmentId}`),
          () => new Error("Failed to navigate to project"),
        );

        if (asyncPushRes.isErr()) {
          toast.error("Failed to navigate to project", {
            description: asyncPushRes.error.message,
          });
          return;
        }

        const invalidateRes = await ResultAsync.fromPromise(
          invalidateProjects(),
          () => new Error("Failed to invalidate projects"),
        );
        if (invalidateRes.isErr()) {
          toast.error("Failed to invalidate projects", {
            description: invalidateRes.error.message,
          });
          return;
        }
      },
      onError: (error) => {
        toast.error("Failed to create project", {
          description: error.message,
        });
      },
    });

  return (
    <BreadcrumbWrapper className={className}>
      <BreadcrumbItem
        flipChevronOnSm
        title="Projects"
        selectedItem={selectedProject}
        items={projectsData?.projects}
        open={isProjectMenuOpen}
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
        onSelect={onEnvironmentIdSelect}
        newItemTitle="New Environment"
        newItemIsPending={false}
        onSelectNewItem={() =>
          toast.success("New environment created", {
            description: "This is fake.",
            duration: 3000,
            closeButton: false,
          })
        }
      />
    </BreadcrumbWrapper>
  );
}
