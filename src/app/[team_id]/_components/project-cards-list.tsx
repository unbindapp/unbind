"use client";

import ProjectCard from "@/app/[team_id]/_components/project-card";
import { api } from "@/server/trpc/setup/client";

type Props = {
  teamId: string;
};

export default function ProjectCardsList({ teamId }: Props) {
  const { data } = api.main.getProjects.useQuery({ teamId });
  const projects = data?.projects;

  console.log("DATA", data);

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
        projects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            className="w-full sm:w-1/2 lg:w-1/3"
          />
        ))}
    </ol>
  );
}
