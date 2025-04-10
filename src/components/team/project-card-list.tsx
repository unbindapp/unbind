"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import { useProjects } from "@/components/project/projects-provider";
import ProjectCard from "@/components/team/project-card";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  teamId: string;
};

export default function ProjectCardList({ teamId }: TProps) {
  const { data } = useProjects();
  const projects = data?.projects;

  const context: TContextCommandPanelContext = useMemo(
    () => ({ contextType: "new-project", teamId }),
    [teamId],
  );

  return (
    <ol className="flex w-full flex-wrap">
      {projects && projects.length === 0 && (
        <li className="flex w-full flex-col p-1 sm:w-1/2 lg:w-1/3">
          <ContextCommandPanel
            title="Create New Project"
            description="Create a new project on Unbind"
            triggerType="list"
            context={context}
          >
            <Button
              variant="ghost"
              className="text-muted-foreground flex min-h-36 w-full items-center justify-center rounded-xl border px-5 py-3.5 text-center font-medium"
            >
              <PlusIcon className="-ml-1.5 size-5 shrink-0" />
              <p className="min-w-0 shrink leading-tight">New Project</p>
            </Button>
          </ContextCommandPanel>
        </li>
      )}
      {projects &&
        projects.length > 0 &&
        projects.map((i) => (
          <ProjectCard key={i.id} project={i} className="w-full sm:w-1/2 lg:w-1/3" />
        ))}
    </ol>
  );
}
