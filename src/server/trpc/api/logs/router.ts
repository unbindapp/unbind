import { query_logsQuerySchema } from "@/server/go/client.gen";
import { getLogLevelFromMessage } from "@/server/trpc/api/logs/helpers";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const logsRouter = createTRPCRouter({
  list: privateProcedure
    .input(
      z
        .object({
          type: query_logsQuerySchema.shape.type,
          teamId: z.string().uuid(),
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          serviceId: z.string().uuid().optional(),
          deploymentId: z.string().uuid().optional(),
          filters: z.string().optional(),
          since: z.enum(["24h", "1w", "1m"]).optional(),
          start: z.string().optional(),
          end: z.string().optional(),
          limit: z.number().optional().default(500),
        })
        .strip(),
    )
    .query(async function ({
      input: {
        type,
        teamId,
        projectId,
        environmentId,
        serviceId,
        deploymentId,
        filters,
        since,
        start,
        end,
        limit,
      },
      ctx: { goClient },
    }) {
      const logsData = await goClient.logs.query({
        type,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        deployment_id: deploymentId,
        filters,
        since,
        start,
        end,
        limit,
        direction: "backward",
      });

      const editedLogsData = logsData.data
        .map((logLine) => {
          const level = getLogLevelFromMessage(logLine.message);
          return {
            ...logLine,
            level,
          };
        })
        .reverse();

      return {
        logs: editedLogsData,
      };
    }),
});
