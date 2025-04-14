"use client";

import { useLogViewState } from "@/components/logs/log-view-state-provider";
import { createSearchFilter } from "@/components/logs/search-filter";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { LogEventSchema } from "@/server/go/client.gen";
import { getLogLevelFromMessage } from "@/server/trpc/api/logs/helpers";
import { TLogLineWithLevel, TLogType } from "@/server/trpc/api/logs/types";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { fetchEventSource } from "@fortaine/fetch-event-source";
import { useSession } from "next-auth/react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";

type TLogsContext = {
  data: TLogLineWithLevel[] | null;
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
  disableStream?: boolean;
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
  disableStream,
  children,
}) => {
  const { data: session } = useSession();
  const { search } = useLogViewState();
  const [start] = useState(
    new Date(httpDefaultStartTimestamp || Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  );
  const [end] = useState(new Date(httpDefaultEndTimestamp || Date.now()).toISOString());
  const [disableStreamLocal] = useState(disableStream || false);
  const latestStreamedTimestamp = useRef(0);

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
  const [streamData, setStreamData] = useState<TLogLineWithLevel[]>([]);
  const [streamError, setStreamError] = useState<Error | null>(null);
  const streamController = useRef<AbortController | null>(null);
  const streamInitTimeout = useRef<NodeJS.Timeout | null>(null);

  const initSSEConnection = useCallback(() => {
    if (!session) return;

    if (!streamController.current) {
      streamController.current = new AbortController();
    } else {
      streamController.current.abort();
      streamController.current = new AbortController();
    }

    fetchEventSource(sseUrl, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${session.access_token}`,
      },
      signal: streamController.current.signal,
      onmessage: (event) => {
        try {
          const newData = JSON.parse(event.data);
          console.log("Log", newData.type, newData);
          if (newData.type !== "log") {
            return;
          }
          const { success, data } = MessageSchema.safeParse(newData);
          if (success) {
            setStreamData((old) => {
              const newLogs: TLogLineWithLevel[] = [];
              let newLogsHighestTimestamp = 0;
              for (let i = 0; i < data.logs.length; i++) {
                const log = data.logs[i];
                const timestamp = log.timestamp ? new Date(log.timestamp).getTime() : undefined;
                if (timestamp) {
                  if (timestamp > latestStreamedTimestamp.current) {
                    newLogs.push({
                      ...log,
                      level: getLogLevelFromMessage(log.message),
                    });
                  }
                  if (timestamp > newLogsHighestTimestamp) {
                    newLogsHighestTimestamp = timestamp;
                  }
                }
              }
              if (newLogsHighestTimestamp > latestStreamedTimestamp.current) {
                latestStreamedTimestamp.current = newLogsHighestTimestamp;
              }
              const updatedLogs = old ? [...old, ...newLogs] : newLogs;
              return updatedLogs;
            });
          }
        } catch (error) {
          setStreamError(new Error("Failed to parse SSE data"));
          console.error("Error parsing SSE data:", error);
        }
      },
      onerror: (error) => {
        console.error("SSE connection error:", error);

        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setStreamError(error);
        }

        if (streamInitTimeout.current) {
          clearTimeout(streamInitTimeout.current);
        }
        streamInitTimeout.current = setTimeout(() => {
          initSSEConnection();
        }, 2000);
      },
    });
  }, [sseUrl, session]);

  useEffect(() => {
    if (disableStreamLocal) return;

    initSSEConnection();

    return () => {
      if (streamController.current) {
        streamController.current.abort();
      }
      if (streamInitTimeout.current) {
        clearTimeout(streamInitTimeout.current);
      }
      streamController.current = null;
    };
  }, [disableStreamLocal, initSSEConnection]);

  const isPending = httpIsPending;
  const error = httpError || streamError;
  const data: TLogLineWithLevel[] | null = useMemo(() => {
    if (httpData && streamData) {
      return [...httpData.logs, ...streamData];
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
