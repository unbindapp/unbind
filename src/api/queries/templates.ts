import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { TemplateInputValue } from "@/server/go/client.gen";

export type TTemplatesList = {
  templates: Awaited<ReturnType<ReturnType<typeof getGoClient>["templates"]["list"]>>["data"];
};

export const templatesListQuery = () =>
  queryOptions({
    queryKey: queryKeys.templates.list(),
    queryFn: async () => {
      const res = await getGoClient().templates.list();
      return { templates: res.data };
    },
  });

export const templateQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.templates.detail(id),
    queryFn: async () => {
      const res = await getGoClient().templates.get({ id });
      return { template: res.data };
    },
  });

export async function deployTemplate(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  templateId: string;
  inputs?: TemplateInputValue[];
  groupName: string;
  groupDescription?: string;
}) {
  const res = await getGoClient().templates.deploy({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    template_id: input.templateId,
    inputs: input.inputs,
    group_name: input.groupName,
    group_description: input.groupDescription,
  });
  return { data: res.data };
}
