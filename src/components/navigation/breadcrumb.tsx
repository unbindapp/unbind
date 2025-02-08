"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsyncRouterPush } from "@/lib/hooks/use-async-router-push";
import { api } from "@/server/trpc/setup/react";
import { SlashIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Breadcrumb() {
  const [asyncRouterPush] = useAsyncRouterPush();
  const pathname = usePathname();
  const pathnameArr = pathname.split("/");

  const teamIdFromPathname =
    pathnameArr.length > 1 ? pathnameArr[1] : undefined;
  const projectIdFromPathname =
    pathnameArr.length > 3 ? pathnameArr[3] : undefined;
  const environmentIdFromPathname =
    pathnameArr.length > 5 ? pathnameArr[5] : undefined;

  const { data: teamData } = api.main.getTeams.useQuery({});
  const { data: projectData } = api.main.getProjects.useQuery(
    { teamId: teamIdFromPathname! },
    {
      enabled: teamIdFromPathname !== undefined,
    }
  );

  const [selectedTeamId, setSelectedTeamId] = useState(teamIdFromPathname);
  const [selectedProjectId, setSelectedProjectId] = useState(
    projectIdFromPathname
  );
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(
    environmentIdFromPathname
  );
  const environments = projectData?.projects.find(
    (p) => p.id === selectedProjectId
  )?.environments;

  useEffect(() => {
    setSelectedTeamId(teamIdFromPathname);
  }, [teamIdFromPathname, teamData]);

  useEffect(() => {
    setSelectedProjectId(projectIdFromPathname);
  }, [projectIdFromPathname, projectData]);

  useEffect(() => {
    setSelectedEnvironmentId(environmentIdFromPathname);
  }, [environmentIdFromPathname]);

  const selectedTeam = selectedTeamId
    ? teamData?.teams.find((t) => t.id === selectedTeamId)
    : undefined;

  const selectedProject = selectedProjectId
    ? projectData?.projects.find((p) => p.id === selectedProjectId)
    : undefined;

  const selectedEnvironment = selectedEnvironmentId
    ? selectedProject?.environments.find((e) => e.id === selectedEnvironmentId)
    : undefined;

  async function onTeamIdValueChange(value: string) {
    setSelectedTeamId(value);
    const team = teamData?.teams.find((t) => t.id === value);
    if (!team) return;
    await asyncRouterPush(`/${team.id}`);
  }

  async function onProjectIdValueChange(value: string) {
    setSelectedProjectId(value);
    const team = teamData?.teams.find((t) => t.id === selectedTeamId);
    const project = projectData?.projects.find((p) => p.id === value);
    const environment = project?.environments[0];
    if (!project || !environment || !team) return;
    await asyncRouterPush(
      `/${team.id}/project/${project.id}/environment/${environment.id}`
    );
  }

  async function onEnvironmentIdValueChange(value: string) {
    setSelectedEnvironmentId(value);
    const team = teamData?.teams.find((t) => t.id === selectedTeamId);
    const project = projectData?.projects.find(
      (p) => p.id === selectedProjectId
    );
    const environment = project?.environments.find((e) => e.id === value);
    if (!project || !environment || !team) return;
    await asyncRouterPush(
      `/${team.id}/project/${project.id}/environment/${environment.id}`
    );
  }

  return (
    <div className="flex shrink min-w-0 items-center justify-start pl-1">
      <Separator />
      <Select value={selectedTeamId} onValueChange={onTeamIdValueChange}>
        <SelectTrigger className="pl-2 pr-3 border-none font-semibold">
          <SelectValue>
            <div className="flex items-center justify-start shrink min-w-0 gap-2">
              <div className="size-5 rounded-full bg-foreground/50"></div>
              <p>{selectedTeam?.title}</p>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="p-1">
          {teamData?.teams.map((i) => (
            <SelectItem
              key={i.id}
              value={i.id}
              onSelect={() => console.log("select")}
            >
              {i.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedProject && (
        <>
          <Separator />
          <Select
            value={selectedProjectId}
            onValueChange={onProjectIdValueChange}
          >
            <SelectTrigger className="pl-2 pr-3 border-none font-semibold">
              <SelectValue>
                <div className="flex items-center justify-start shrink min-w-0 gap-2">
                  <div className="size-5 rounded-full bg-foreground/50"></div>
                  <p>{selectedProject?.title}</p>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="p-1">
              {projectData?.projects.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      {selectedEnvironment && (
        <>
          <Separator />
          <Select
            value={selectedEnvironmentId}
            onValueChange={onEnvironmentIdValueChange}
          >
            <SelectTrigger className="px-3 border-none font-semibold">
              <SelectValue>
                <div className="flex items-center justify-start shrink min-w-0 gap-2">
                  <p>{selectedEnvironment?.title}</p>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="p-1">
              {environments?.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}

function Separator({ className }: { className?: string }) {
  return (
    <SlashIcon
      className={`text-foreground/16 -rotate-30 size-4 ${className}`}
      strokeWidth={3}
    />
  );
}
