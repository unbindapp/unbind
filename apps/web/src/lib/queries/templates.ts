import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import type { TemplateInputValue } from "@/server/client.gen";

export type TTemplatesList = {
  templates: Awaited<ReturnType<ReturnType<typeof getGoClient>["templates"]["list"]>>["data"];
};

export const queryKeyTemplates = {
  list: () => ["templates", "list"] as const,
  detail: (input: { id: string }) => ["templates", "detail", input.id] as const,
};

export const templatesListQuery = () =>
  queryOptions({
    queryKey: queryKeyTemplates.list(),
    queryFn: async () => {
      const res = await getGoClient().templates.list();
      return { templates: res.data };
    },
  });

export const templateQuery = (input: { id: string }) =>
  queryOptions({
    queryKey: queryKeyTemplates.detail(input),
    queryFn: async () => {
      const res = await getGoClient().templates.get({ id: input.id });
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
