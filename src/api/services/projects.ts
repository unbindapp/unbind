import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { ProjectResponse } from "@/server/go/client.gen";
import { generateProjectName } from "@/lib/helpers/generate-project-name";

export type TProjectShallow = ProjectResponse;

// Mirrors the old projects tRPC router: same inputs + `res.data` → `{ projects }` / `{ project }`.
export const projectsListQuery = (teamId: string) =>
  queryOptions({
    queryKey: queryKeys.projects.list(teamId),
    queryFn: async () => {
      const res = await getGoClient().projects.list({ team_id: teamId });
      return { projects: res.data };
    },
  });

export const projectQuery = (teamId: string, projectId: string) =>
  queryOptions({
    queryKey: queryKeys.projects.detail(teamId, projectId),
    queryFn: async () => {
      const res = await getGoClient().projects.get({ team_id: teamId, project_id: projectId });
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
