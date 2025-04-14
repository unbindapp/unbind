"use client";

import { useLogViewState } from "@/components/logs/log-view-state-provider";
import { createSearchFilter } from "@/components/logs/search-filter";
import { useAppConfig } from "@/components/providers/app-config-provider";
import useSSEQuery from "@/lib/hooks/use-sse-query";
import { LogEventSchema } from "@/server/go/client.gen";
import { getLogLevelFromMessage } from "@/server/trpc/api/logs/helpers";
import { TLogLineWithLevel, TLogType } from "@/server/trpc/api/logs/types";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { useSession } from "next-auth/react";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { z } from "zod";

type TLogsContext = {
  data: TLogLineWithLevel[] | null;
  isPending: boolean;
  error: Error | AppRouterQueryResult<AppRouterOutputs["logs"]["list"]>["error"] | null;
};

const LogsContext = createContext<TLogsContext | null>(null);

export const MessageSchema = z.object({ type: z.string(), logs: LogEventSchema.array() }).strip();
export type TMessage = z.infer<typeof MessageSchema>;

type TBaseProps = {
  children: ReactNode;
  teamId: string;
  projectId: string;
  type: TLogType;
  httpDefaultStartTimestamp?: number;
  httpDefaultEndTimestamp?: number;
};

export type TEnvironmentLogsProps = {
  type: "environment";
  environmentId: string;
  serviceId?: never;
  deploymentId?: never;
};

export type TServiceLogsProps = {
  type: "service";
  environmentId: string;
  serviceId: string;
  deploymentId?: never;
};

export type TDeploymentLogsProps = {
  type: "deployment";
  environmentId: string;
  serviceId: string;
  deploymentId: string;
};

export type TDeploymentBuildLogsProps = {
  type: "build";
  environmentId: string;
  serviceId: string;
  deploymentId: string;
};

type TProps = TBaseProps &
  (TEnvironmentLogsProps | TServiceLogsProps | TDeploymentLogsProps | TDeploymentBuildLogsProps);

export const LogsProvider: React.FC<TProps> = ({
  type,
  teamId,
  projectId,
  environmentId,
  serviceId,
  deploymentId,
  httpDefaultStartTimestamp,
  httpDefaultEndTimestamp,
  children,
}) => {
  const { data: session } = useSession();
  const { search } = useLogViewState();
  const [start] = useState(
    new Date(httpDefaultStartTimestamp || Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  );
  const [end] = useState(
    httpDefaultEndTimestamp ? new Date(httpDefaultEndTimestamp).toISOString() : null,
  );
  const isFiniteQuery = !!start && !!end;

  const filtersStr = createSearchFilter(search);
  const limit = 1000;

  const {
    data: httpData,
    isPending: httpIsPending,
    error: httpError,
  } = api.logs.list.useQuery(
    {
      type,
      teamId,
      projectId,
      environmentId,
      serviceId,
      deploymentId,
      filters: filtersStr,
      limit,
      start,
      end: end!,
    },
    {
      enabled: isFiniteQuery,
    },
  );

  const { apiUrl } = useAppConfig();
  const sseUrl = useMemo(() => {
    const params = new URLSearchParams({
      type: type,
      team_id: teamId,
      project_id: projectId || "",
      environment_id: environmentId || "",
      limit: limit.toString(),
      start: start,
    });
    if (type === "service" || type === "deployment") {
      params.set("service_id", serviceId);
    }
    if (type === "deployment" || type === "build") {
      params.set("deployment_id", deploymentId);
    }
    if (filtersStr) {
      params.set("filters", filtersStr);
    }
    return `${apiUrl}/logs/stream?${params.toString()}`;
  }, [type, apiUrl, teamId, projectId, environmentId, serviceId, deploymentId, filtersStr, start]);

  const { data: streamDataRaw, error: streamError } = useSSEQuery({
    url: sseUrl,
    parser: MessageSchema,
    disabled: !session || isFiniteQuery,
    filter: (obj) => obj.type === "log",
    accessToken: session?.access_token || "",
  });

  const streamData = useMemo(() => {
    const logs: TLogLineWithLevel[] = [];
    if (!streamDataRaw) return null;
    for (const entry of streamDataRaw) {
      const { logs: logEntries } = entry;
      for (const logEntry of logEntries) {
        const logLevel = getLogLevelFromMessage(logEntry.message);
        logs.push({
          ...logEntry,
          level: logLevel,
        });
      }
    }
    return logs;
  }, [streamDataRaw]);

  const isPending = isFiniteQuery ? httpIsPending : !streamData;
  const error = httpError || streamError;
  const data: TLogLineWithLevel[] | null = useMemo(() => {
    if (isFiniteQuery && httpData) {
      return [...httpData.logs];
    }
    if (!isFiniteQuery && streamData) {
      return streamData;
    }
    return null;
  }, [httpData, streamData, isFiniteQuery]);

  const value: TLogsContext = useMemo(() => ({ data, isPending, error }), [data, isPending, error]);

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
};

export const useLogs = () => {
  const context = useContext(LogsContext);
  if (!context) {
    throw new Error("useLogs must be used within an LogsProvider");
  }
  return context;
};

export default LogsProvider;
