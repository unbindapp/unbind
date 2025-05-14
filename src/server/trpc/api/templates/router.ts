import { TemplateInputValueSchema } from "@/server/go/client.gen";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const templatesRouter = createTRPCRouter({
  get: privateProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { id }, ctx: { goClient } }) {
      const res = await goClient.templates.get({ id });
      return {
        template: res.data,
      };
    }),
  list: privateProcedure.query(async function ({ ctx: { goClient } }) {
    const res = await goClient.templates.list();
    return {
      templates: res.data,
    };
  }),
  deploy: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
          templateId: z.string().uuid(),
          inputs: TemplateInputValueSchema.array().optional(),
          groupName: z.string(),
        })
        .strip(),
    )
    .mutation(async function ({
      input: { teamId, projectId, environmentId, templateId, inputs, groupName },
      ctx: { goClient },
    }) {
      const res = await goClient.templates.deploy({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        template_id: templateId,
        inputs,
        group_name: groupName,
      });

      return {
        data: res.data,
      };
    }),
});
