import { getGoClient } from "@/api/client";

export async function updateServiceGroup(input: {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  name: string;
  description: string;
}) {
  const res = await getGoClient().service_groups.update({
    id: input.id,
    team_id: input.teamId,
    environment_id: input.environmentId,
    project_id: input.projectId,
    name: input.name,
    description: input.description,
  });
  return { serviceGroup: res.data };
}

export async function deleteServiceGroup(input: {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  deleteServices: boolean;
}) {
  const res = await getGoClient().service_groups.delete({
    id: input.id,
    team_id: input.teamId,
    environment_id: input.environmentId,
    project_id: input.projectId,
    delete_services: input.deleteServices,
  });
  return { data: res.data };
}
