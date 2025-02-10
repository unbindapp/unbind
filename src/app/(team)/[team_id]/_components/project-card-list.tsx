"use client";

import ProjectCard from "@/app/(team)/[team_id]/_components/project-card";
import { api } from "@/server/trpc/setup/client";

type Props = {
  teamId: string;
};

export default function ProjectCardList({ teamId }: Props) {
  const [, { data }] = api.main.getProjects.useSuspenseQuery({
    teamId,
  });
  const projects = data?.projects;

  return (
    <ol className="w-full flex flex-wrap">
      {projects && projects.length === 0 && (
        <li className="w-full flex items-center justify-center p-1">
          <p className="w-full text-muted-foreground px-5 text-center rounded-xl border py-16">
            No projects yet
          </p>
        </li>
      )}
      {projects &&
        projects.length > 0 &&
        projects.map((i) => (
          <ProjectCard
            key={i.id}
            project={i}
            className="w-full sm:w-1/2 lg:w-1/3"
          />
        ))}
    </ol>
  );
}
