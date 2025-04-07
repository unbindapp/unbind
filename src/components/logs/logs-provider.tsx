"use client";

import { useLogViewState } from "@/components/logs/log-view-state-provider";
import { createSearchFilter } from "@/components/logs/search-filter";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { LogEventSchema } from "@/server/go/client.gen";
import { TLogType } from "@/server/trpc/api/logs/types";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { fetchEventSource } from "@fortaine/fetch-event-source";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { z } from "zod";

type TLogsContext = {
  data: TMessage["logs"] | null;
  isPending: boolean;
  error: Error | AppRouterQueryResult<AppRouterOutputs["logs"]["list"]>["error"] | null;
};

const LogsContext = createContext<TLogsContext | null>(null);

export const MessageSchema = z.object({ logs: LogEventSchema.array() }).strip();
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

type TProps = TBaseProps & (TEnvironmentLogsProps | TServiceLogsProps | TDeploymentLogsProps);

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
  const [end] = useState(new Date(httpDefaultEndTimestamp || Date.now()).toISOString());

  const filtersStr = createSearchFilter(search);
  const limit = 1000;

  const {
    data: httpData,
    isPending: httpIsPending,
    error: httpError,
  } = api.logs.list.useQuery({
    type,
    teamId,
    projectId,
    environmentId,
    serviceId,
    deploymentId,
    filters: filtersStr,
    limit,
    start,
    end,
  });

  const urlParams = useMemo(() => {
    const params = new URLSearchParams({
      type: type,
      team_id: teamId,
      project_id: projectId || "",
      environment_id: environmentId || "",
      start: end,
      limit: limit.toString(),
    });
    if (type === "service" || type === "deployment") {
      params.set("service_id", serviceId);
    }
    if (type === "deployment") {
      params.set("deployment_id", deploymentId);
    }
    if (filtersStr) {
      params.set("filters", filtersStr);
    }
    return params;
  }, [type, teamId, projectId, environmentId, serviceId, deploymentId, filtersStr, end]);

  const { apiUrl } = useAppConfig();
  const sseUrl = `${apiUrl}/logs/stream?${urlParams.toString()}`;
  const queryClient = useQueryClient();

  const {
    data: streamData,
    isPending: streamIsPending,
    error: streamIsError,
  } = useQuery({
    enabled: !!session,
    queryKey: ["logs-stream", sseUrl],
    queryFn: async () => {
      if (httpDefaultEndTimestamp) {
        console.log("Stream is disabled");
        return [];
      } else {
        console.log("Stream is enabled");
      }
      const controller = new AbortController();
      fetchEventSource(sseUrl, {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${session?.access_token}`,
        },
        signal: controller.signal,
        onmessage: (event) => {
          try {
            const newData = JSON.parse(event.data);
            if (newData.type !== "log") {
              console.log("Log", newData.type, newData);
              return;
            }
            const { success, data } = MessageSchema.safeParse(newData);
            if (success) {
              queryClient.setQueryData(["logs-stream", sseUrl], (old: TMessage["logs"]) => {
                const updatedLogs = old ? [...old, ...data.logs] : data.logs;
                return updatedLogs;
              });
            }
          } catch (error) {
            console.error("Error parsing SSE data:", error);
          }
        },
        onerror: (error) => {
          console.error("SSE connection error:", error);
          controller.abort();
        },
      });

      return [];
    },
  });

  const isPending = httpIsPending || streamIsPending;
  const error = httpError || streamIsError;
  const data: TMessage["logs"] | null = useMemo(() => {
    if (httpData && streamData) {
      return [...httpData.logs, ...(streamData as TMessage["logs"])];
    }
    return null;
  }, [httpData, streamData]);

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
