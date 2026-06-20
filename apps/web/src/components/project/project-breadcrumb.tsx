"use client";

import {
  CreateEnvironmentDialog,
  TCreateEnvironmentDialogProps,
} from "@/components/environment/create-environment-dialog";
import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbSeparator, BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useProjects, useProjectsUtils } from "@/components/project/projects-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { createProject as createProjectFn } from "@/lib/queries/projects";
import { useMutation } from "@tanstack/react-query";
import { errAsync, ResultAsync } from "neverthrow";
import { useLocation, useRouter } from "@tanstack/react-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type TProps = {
  className?: string;
};

export default function ProjectBreadcrumb({ className }: TProps) {
  const router = useRouter();
  const pathname = useLocation({ select: (l) => l.pathname });
  const searchStr = useLocation({ select: (l) => l.searchStr }).replace(/^\?/, "");

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

  // Resolve a project's default (or first) environment id for navigation.
  const resolveDefaultEnvironmentId = useCallback(
    (projectId: string) => {
      const project = projectsData?.projects.find((p) => p.id === projectId);
      const environments = project?.environments;
      if (!environments || environments.length < 1) return null;
      const environment = project.default_environment_id
        ? environments.find((e) => e.id === project.default_environment_id)
        : environments[0];
      return environment?.id ?? null;
    },
    [projectsData],
  );

  const onProjectIdSelect = useCallback(
    async (id: string) => {
      setSelectedProjectId(id);
      const environment = resolveDefaultEnvironmentId(id);
      if (!environment || !teamIdFromPathname) return;
      await router.navigate({
        to: "/$team_id/project/$project_id",
        params: { team_id: teamIdFromPathname, project_id: id },
        search: { environment },
      });
    },
    [resolveDefaultEnvironmentId, teamIdFromPathname, router],
  );

  const onProjectIdIntent = useCallback(
    (id: string) => {
      const environment = resolveDefaultEnvironmentId(id);
      if (!environment || !teamIdFromPathname) return;
      void router.preloadRoute({
        to: "/$team_id/project/$project_id",
        params: { team_id: teamIdFromPathname, project_id: id },
        search: { environment },
      });
    },
    [resolveDefaultEnvironmentId, teamIdFromPathname, router],
  );

  // Switching environment stays on the current route and only swaps the
  // `environment` search param, preserving any other search params.
  const onEnvironmentIdSelect = useCallback(
    async (id: string) => {
      setSelectedEnvironmentId(id);
      await router.navigate({ to: ".", search: (prev) => ({ ...prev, environment: id }) });
    },
    [router],
  );

  const onEnvironmentIdIntent = useCallback(
    (id: string) => {
      void router.preloadRoute({ to: ".", search: (prev) => ({ ...prev, environment: id }) });
    },
    [router],
  );

  const getEnvironmentManageItemNav = useCallback(() => {
    if (!teamIdFromPathname || !selectedProjectId) return null;
    return {
      to: "/$team_id/project/$project_id/settings/environments",
      params: { team_id: teamIdFromPathname, project_id: selectedProjectId },
      search: { environment: environmentIdFromPathname || selectedEnvironmentId || undefined },
    } as const;
  }, [teamIdFromPathname, selectedProjectId, environmentIdFromPathname, selectedEnvironmentId]);

  const onSelectEnvironmentManageItem = useCallback(() => {
    const nav = getEnvironmentManageItemNav();
    if (nav) void router.navigate(nav);
  }, [getEnvironmentManageItemNav, router]);

  const onIntentEnvironmentManageItem = useCallback(() => {
    const nav = getEnvironmentManageItemNav();
    if (nav) void router.preloadRoute(nav);
  }, [getEnvironmentManageItemNav, router]);

  const { mutate: createProject, isPending: isPendingCreateProject } = useMutation({
    mutationFn: createProjectFn,
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
      if (!projectId || !environmentId || !teamIdFromPathname) {
        toast.error("Project or environment ID is missing", {
          description: "Project ID or Environment ID is missing",
        });
        return;
      }

      setIsProjectsMenuOpen(false);
      invalidateProjects();

      const navigateRes = await ResultAsync.fromPromise(
        router.navigate({
          to: "/$team_id/project/$project_id",
          params: { team_id: teamIdFromPathname, project_id: projectId },
          search: { environment: environmentId },
        }),
        () => new Error("Failed to navigate to project"),
      );

      if (navigateRes.isErr()) {
        toast.error("Failed to navigate to project", {
          description: navigateRes.error.message,
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
    props: Omit<
      TCreateEnvironmentDialogProps,
      "onFormSubmitSuccessful" | "asyncOnFormSubmitSuccessful"
    >,
  ) => ReactNode = useCallback(
    (props) => (
      <CreateEnvironmentDialog
        {...props}
        onFormSubmitSuccessful={() => setIsEnvironmentsMenuOpen(false)}
        asyncOnFormSubmitSuccessful={({ environment }) => {
          if (!teamIdFromPathname || !selectedProjectId) {
            return errAsync(new Error("Team or project ID is missing"));
          }
          return ResultAsync.fromPromise(
            router.navigate({
              to: ".",
              search: { environment: environment.id },
            }),
            () => new Error("Failed to navigate to project"),
          );
        }}
        dialogOnOpenChange={(o) => {
          if (!o) setIsEnvironmentsMenuOpen(false);
        }}
      />
    ),
    [teamIdFromPathname, selectedProjectId, router],
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
        onIntent={onProjectIdIntent}
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
          const environment = resolveDefaultEnvironmentId(project.id);
          if (!environment || !teamIdFromPathname) return false;
          const target = router.buildLocation({
            to: "/$team_id/project/$project_id",
            params: { team_id: teamIdFromPathname, project_id: project.id },
            search: { environment },
          });
          const current = `${pathname}${searchStr ? `?${searchStr}` : ""}`;
          return target.href !== current;
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
        onIntent={onEnvironmentIdIntent}
        newItemTitle="New Environment"
        newItemIsPending={false}
        NewItemWrapper={CreateEnvironmentDialogMemoized}
        newItemDontCloseMenuOnSelect={true}
        onSelectNewItem={() => null}
        manageItemTitle="Manage"
        onSelectManageItem={onSelectEnvironmentManageItem}
        onIntentManageItem={onIntentEnvironmentManageItem}
      />
    </BreadcrumbWrapper>
  );
}
