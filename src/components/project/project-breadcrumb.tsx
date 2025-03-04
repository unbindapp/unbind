"use client";

import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbSeparator, BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";
import { useEffect, useState } from "react";
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

  const { data: teamData } = api.main.getTeams.useQuery({});
  const { data: projectsData } = api.main.getProjects.useQuery(
    { teamId: teamIdFromPathname! },
    {
      enabled: teamIdFromPathname !== undefined,
    },
  );

  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromPathname);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(environmentIdFromPathname);
  const environments = projectsData?.projects.find((p) => p.id === selectedProjectId)?.environments;

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
    const project = projectsData?.projects.find((p) => p.id === selectedProjectId);
    const environment = project?.environments.find((e) => e.id === id);
    if (!project || !environment || !team) return null;
    return `/${team.id}/project/${project.id}/environment/${environment.id}`;
  }

  return (
    <BreadcrumbWrapper className={className}>
      <BreadcrumbItem
        flipChevronOnSm
        title="Projects"
        selectedItem={selectedProject}
        items={projectsData?.projects}
        onSelect={onProjectIdSelect}
        getHrefForId={getHrefForProjectId}
        newItemTitle="New Project"
        onSelectNewItem={() =>
          toast.success("New project created", {
            description: "This is fake.",
            duration: 3000,
            closeButton: false,
          })
        }
      />
      <BreadcrumbSeparator />
      <BreadcrumbItem
        flipChevronOnSm
        title="Environments"
        selectedItem={selectedEnvironment}
        items={environments}
        onSelect={onEnvironmentIdSelect}
        getHrefForId={getHrefForEnvironmentId}
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
