"use client";

import { useAsyncPush } from "@/components/providers/async-push-provider";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { api } from "@/server/trpc/setup/client";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  SlashIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { FC, JSX, useEffect, useState } from "react";

export default function Breadcrumb() {
  const { asyncPush } = useAsyncPush();
  const pathname = usePathname();
  const pathnameArr = pathname.split("/");

  const teamIdFromPathname =
    pathnameArr.length > 1 ? pathnameArr[1] : undefined;
  const projectIdFromPathname =
    pathnameArr.length > 3 ? pathnameArr[3] : undefined;
  const environmentIdFromPathname =
    pathnameArr.length > 5 ? pathnameArr[5] : undefined;

  const { data: teamData } = api.main.getTeams.useQuery({});
  const { data: projectsData } = api.main.getProjects.useQuery(
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
  const environments = projectsData?.projects.find(
    (p) => p.id === selectedProjectId
  )?.environments;

  useEffect(() => {
    setSelectedTeamId(teamIdFromPathname);
  }, [teamIdFromPathname, teamData]);

  useEffect(() => {
    setSelectedProjectId(projectIdFromPathname);
  }, [projectIdFromPathname, projectsData]);

  useEffect(() => {
    setSelectedEnvironmentId(environmentIdFromPathname);
  }, [environmentIdFromPathname]);

  const selectedTeam = selectedTeamId
    ? teamData?.teams.find((t) => t.id === selectedTeamId)
    : undefined;

  const selectedProject = selectedProjectId
    ? projectsData?.projects.find((p) => p.id === selectedProjectId)
    : undefined;

  const selectedEnvironment = selectedEnvironmentId
    ? selectedProject?.environments.find((e) => e.id === selectedEnvironmentId)
    : undefined;

  async function onTeamIdSelect(id: string) {
    setSelectedTeamId(id);
    const href = getHrefForTeamId(id);
    if (!href) return;
    await asyncPush(href);
  }

  function getHrefForTeamId(id: string) {
    const team = teamData?.teams.find((t) => t.id === id);
    if (!team) return null;
    return `/${team.id}`;
  }

  async function onProjectIdSelect(id: string) {
    setSelectedProjectId(id);
    const href = getHrefForProjectId(id);
    if (!href) return;
    await asyncPush(href);
  }

  function getHrefForProjectId(id: string) {
    const team = teamData?.teams.find((t) => t.id === selectedTeamId);
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
    const team = teamData?.teams.find((t) => t.id === selectedTeamId);
    const project = projectsData?.projects.find(
      (p) => p.id === selectedProjectId
    );
    const environment = project?.environments.find((e) => e.id === id);
    if (!project || !environment || !team) return null;
    return `/${team.id}/project/${project.id}/environment/${environment.id}`;
  }

  return (
    <div className="flex shrink min-w-0 items-center justify-start pl-1">
      {!projectIdFromPathname && selectedTeam && (
        <>
          <Separator />
          <Dropdown
            selectedItem={selectedTeam}
            items={teamData?.teams}
            onSelect={onTeamIdSelect}
            /* IconItem={({ id }) => (
              <Blockies address={id} className="size-4 rounded-full" />
            )} */
            getHrefForId={getHrefForTeamId}
          />
        </>
      )}
      {selectedProject && (
        <>
          <Separator />
          <Dropdown
            selectedItem={selectedProject}
            items={projectsData?.projects}
            onSelect={onProjectIdSelect}
            getHrefForId={getHrefForProjectId}
          />
        </>
      )}
      {selectedEnvironment && (
        <>
          <Separator />
          <Dropdown
            selectedItem={selectedEnvironment}
            items={environments}
            onSelect={onEnvironmentIdSelect}
            getHrefForId={getHrefForEnvironmentId}
          />
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

function Dropdown<T extends { id: string; title: string }>({
  selectedItem,
  items,
  onSelect,
  Icon,
  getHrefForId,
  IconItem,
}: {
  selectedItem: T | undefined;
  items: T[] | undefined;
  onSelect: (id: string) => void;
  Icon?: JSX.Element;
  getHrefForId: (id: string) => string | null;
  IconItem?: FC<{ id: string }>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        data-no-icon={Icon === undefined ? true : undefined}
        className={cn(
          buttonVariants({
            variant: "ghost",
            size: "sm",
            forceMinSize: false,
          }),
          "px-1.5 py-1.75 data-[no-icon]:pl-2.75 rounded-lg border-none font-semibold flex items-center justify-start shrink min-w-0 gap-2 not-touch:hover:bg-border text-sm group/trigger"
        )}
      >
        {IconItem && selectedItem && <IconItem id={selectedItem.id} />}
        <p>{selectedItem?.title}</p>
        <ChevronDownIcon className="size-4 -ml-1 text-muted-more-foreground group-data-[state=open]/trigger:rotate-180 transition" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="group/content">
        <ScrollArea className="p-1">
          {items?.map((i, index) => {
            const href = getHrefForId(i.id);
            const showArrow = href !== null && pathname !== href;
            return (
              <DropdownMenuItem
                onSelect={() => {
                  setOpen(false);
                  onSelect(i.id);
                }}
                key={i.id + index}
                data-show-arrow={showArrow ? true : undefined}
                className="py-2 flex items-center justify-between gap-2.5 group/item"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  {IconItem && <IconItem id={i.id} />}
                  <p className="shrink min-w-0">{i.title}</p>
                </div>
                <div className="size-4 -mr-0.5 relative">
                  {selectedItem?.id === i.id && (
                    <>
                      <CheckIcon
                        className="size-full group-data-[show-arrow]/item:group-data-[highlighted]/item:opacity-0 group-data-[show-arrow]/item:group-data-[highlighted]/item:rotate-90 transition"
                        strokeWidth={3}
                      />
                      <ArrowRightIcon
                        className="absolute left-0 top-0 opacity-0 -rotate-90 size-full group-data-[show-arrow]/item:group-data-[highlighted]/item:opacity-100
                        group-data-[show-arrow]/item:group-data-[highlighted]/item:rotate-0 transition"
                        strokeWidth={2.5}
                      />
                    </>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
