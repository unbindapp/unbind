"use client";

import { useProjects } from "@/components/project/projects-provider";
import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbSeparator, BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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

  return (
    <BreadcrumbWrapper className={className}>
      <BreadcrumbItem
        flipChevronOnSm
        title="Projects"
        selectedItem={selectedProject}
        items={projectsData?.projects}
        onSelect={onProjectIdSelect}
        newItemTitle="New Project"
        onSelectNewItem={() =>
          toast.success("New project created", {
            description: "This is fake.",
            duration: 3000,
            closeButton: false,
          })
        }
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
