import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import type { ProjectResponse } from "@/server/client.gen";
import { generateProjectName } from "@/lib/helpers/generate-project-name";

export type TProjectShallow = ProjectResponse;

export const queryKeyProjects = {
  list: (input: { teamId: string }) => ["projects", "list", input.teamId] as const,
  detail: (input: { teamId: string; projectId: string }) =>
    ["projects", "detail", input.teamId, input.projectId] as const,
};

// Mirrors the old projects tRPC router: same inputs + `res.data` → `{ projects }` / `{ project }`.
export const projectsListQuery = (input: { teamId: string }) =>
  queryOptions({
    queryKey: queryKeyProjects.list(input),
    queryFn: async () => {
      const res = await getGoClient().projects.list({ team_id: input.teamId });
      return { projects: res.data };
    },
  });

export const projectQuery = (input: { teamId: string; projectId: string }) =>
  queryOptions({
    queryKey: queryKeyProjects.detail(input),
    queryFn: async () => {
      const res = await getGoClient().projects.get({
        team_id: input.teamId,
        project_id: input.projectId,
      });
      return { project: res.data };
    },
  });

export async function createProject(input: {
  teamId: string;
  name?: string;
  description?: string;
}) {
  const res = await getGoClient().projects.create({
    team_id: input.teamId,
    name: input.name || generateProjectName(),
    description: input.description,
  });
  return { data: res.data };
}

export async function updateProject(input: {
  teamId: string;
  projectId: string;
  name: string;
  description: string;
}) {
  const res = await getGoClient().projects.update({
    team_id: input.teamId,
    project_id: input.projectId,
    name: input.name,
    description: input.description,
  });
  return { data: res.data };
}

export async function deleteProject(input: { teamId: string; projectId: string }) {
  const res = await getGoClient().projects.delete({
    team_id: input.teamId,
    project_id: input.projectId,
  });
  return { data: res.data };
}
