"use client";

import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import {
  BreadcrumbSeparator,
  BreadcrumbWrapper,
} from "@/components/navigation/breadcrumb-wrapper";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useAppPathnames } from "@/lib/hooks/use-app-pathnames";
import { api } from "@/server/trpc/setup/client";
import { useEffect, useState } from "react";

type Props = {
  className?: string;
};

export default function ProjectBreadcrumb({ className }: Props) {
  const { asyncPush } = useAsyncPush();
  const {
    teamId: teamIdFromPathname,
    projectId: projectIdFromPathname,
    environmentId: environmentIdFromPathname,
  } = useAppPathnames();

  const { data: teamData } = api.main.getTeams.useQuery({});
  const { data: projectsData } = api.main.getProjects.useQuery(
    { teamId: teamIdFromPathname! },
    {
      enabled: teamIdFromPathname !== undefined,
    }
  );

  const [selectedProjectId, setSelectedProjectId] = useState(
    projectIdFromPathname
  );
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(
    environmentIdFromPathname
  );
  const environments = projectsData?.projects.find(
    (p) => p.id === selectedProjectId
  )?.environments;

  useEffect(() => {
    setSelectedProjectId(projectIdFromPathname);
  }, [projectIdFromPathname, projectsData]);

  useEffect(() => {
    setSelectedEnvironmentId(environmentIdFromPathname);
  }, [environmentIdFromPathname]);

  const selectedProject = selectedProjectId
    ? projectsData?.projects.find((p) => p.id === selectedProjectId)
    : undefined;

  const selectedEnvironment = selectedEnvironmentId
    ? selectedProject?.environments.find((e) => e.id === selectedEnvironmentId)
    : undefined;

  async function onProjectIdSelect(id: string) {
    setSelectedProjectId(id);
    const href = getHrefForProjectId(id);
    if (!href) return;
    await asyncPush(href);
  }

  function getHrefForProjectId(id: string) {
    const team = teamData?.teams.find((t) => t.id === teamIdFromPathname);
    const project = projectsData?.projects.find((p) => p.id === id);
    const environment = project?.environments[0];
    if (!project || !environment || !team) return null;
    return `/${team.id}/project/${project.id}/environment/${environment.id}`;
  }

  async function onEnvironmentIdSelect(id: string) {
    setSelectedEnvironmentId(id);
    const href = getHrefForEnvironmentId(id);
    if (!href) return;
    await asyncPush(href);
  }

  function getHrefForEnvironmentId(id: string) {
    const team = teamData?.teams.find((t) => t.id === teamIdFromPathname);
    const project = projectsData?.projects.find(
      (p) => p.id === selectedProjectId
    );
    const environment = project?.environments.find((e) => e.id === id);
    if (!project || !environment || !team) return null;
    return `/${team.id}/project/${project.id}/environment/${environment.id}`;
  }

  return (
    <BreadcrumbWrapper className={className}>
      <BreadcrumbItem
        selectedItem={selectedProject}
        items={projectsData?.projects}
        onSelect={onProjectIdSelect}
        getHrefForId={getHrefForProjectId}
      />
      <BreadcrumbSeparator />
      <BreadcrumbItem
        selectedItem={selectedEnvironment}
        items={environments}
        onSelect={onEnvironmentIdSelect}
        getHrefForId={getHrefForEnvironmentId}
      />
    </BreadcrumbWrapper>
  );
}
