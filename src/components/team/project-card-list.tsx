"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import ErrorCard from "@/components/error-card";
import { useProjects } from "@/components/project/projects-provider";
import ProjectCard from "@/components/team/project-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";
import { ReactNode, useMemo } from "react";

type TProps = {
  teamId: string;
};

const placeholderArray = Array.from({ length: 3 });

export default function ProjectCardList({ teamId }: TProps) {
  const { data, isPending, error } = useProjects();
  const projects = data?.projects;

  const context: TContextCommandPanelContext = useMemo(
    () => ({ contextType: "new-project", teamId }),
    [teamId],
  );

  if (!projects && !isPending && error) {
    return (
      <Wrapper>
        <li className="w-full p-1">
          <ErrorCard message={error.message} />
        </li>
      </Wrapper>
    );
  }

  if (!projects || isPending) {
    return (
      <Wrapper>
        {placeholderArray.map((_, index) => (
          <ProjectCard key={index} isPlaceholder className="w-full md:w-1/2 lg:w-1/3" />
        ))}
      </Wrapper>
    );
  }

  if (projects.length === 0) {
    return (
      <Wrapper>
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
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {projects.map((i) => (
        <ProjectCard key={i.id} project={i} className="w-full md:w-1/2 lg:w-1/3" />
      ))}
    </Wrapper>
  );
}

function Wrapper({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("flex w-full flex-wrap", className)}>{children}</ol>;
}
