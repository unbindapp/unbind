"use client";

import { useLogViewState } from "@/components/logs/log-view-state-provider";
import { createSearchFilter } from "@/components/logs/search-filter";
import { env } from "@/lib/env";
import { fetchEventSource } from "@fortaine/fetch-event-source";
import { QueryKey, useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { createContext, ReactNode, useContext, useEffect, useMemo } from "react";
import { z } from "zod";

type TLogsContext = UseQueryResult<TLogLine[]> & {};

const LogsContext = createContext<TLogsContext | null>(null);

export const LogLineSchema = z
  .object({
    message: z.string(),
    pod_name: z.string(),
    timestamp: z.string(),
    metadata: z
      .object({
        team_id: z.string(),
        project_id: z.string(),
        environment_id: z.string(),
        service_id: z.string(),
      })
      .strip(),
  })
  .strip();
export type TLogLine = z.infer<typeof LogLineSchema>;

export const MessageSchema = z.object({ logs: LogLineSchema.array() });
export type TMessage = z.infer<typeof MessageSchema>;

export type TLogType = "team" | "project" | "environment" | "service";

type TBaseProps = {
  children: ReactNode;
  teamId: string;
  projectId: string;
  environmentId: string;
  type: TLogType;
};

type TProps = TBaseProps &
  (
    | {
        type: "environment";
        serviceId?: never;
      }
    | {
        type: "service";
        serviceId: string;
      }
  );

export const LogsProvider: React.FC<TProps> = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
  type,
  children,
}) => {
  const { data: session } = useSession();
  const { search } = useLogViewState();

  const filtersStr = createSearchFilter(search);

  const urlParams = useMemo(() => {
    const params = new URLSearchParams({
      team_id: teamId,
      project_id: projectId,
      environment_id: environmentId,
      type: type,
      tail: "1000",
      since: "24h",
    });
    if (type === "service") {
      params.set("service_id", serviceId);
    }
    if (filtersStr) {
      params.set("filters", filtersStr);
    }
    return params;
  }, [teamId, projectId, environmentId, serviceId, type, filtersStr]);

  const sseUrl = `${env.NEXT_PUBLIC_UNBIND_API_URL}/logs/stream?${urlParams.toString()}`;

  const queryClient = useQueryClient();

  const queryKey: QueryKey = useMemo(() => ["logs", sseUrl], [sseUrl]);
  const queryResult = useQuery<TLogLine[]>({ queryKey: ["logs", sseUrl] });

  useEffect(() => {
    if (!session) return;
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
          console.log("New data:", newData);
          const parsedData = MessageSchema.parse(newData);
          queryClient.setQueryData(queryKey, (old: TLogLine[]) => {
            const newLogs = parsedData.logs.filter(
              (l) => !old?.some((o) => o.timestamp === l.timestamp),
            );
            return [...(old || []), ...newLogs];
          });
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      },
      onerror: (error) => {
        console.error("SSE connection error:", error);
        controller.abort();
      },
    });

    return () => {
      controller.abort();
    };
  }, [queryClient, queryKey, sseUrl, session]);

  return <LogsContext.Provider value={queryResult}>{children}</LogsContext.Provider>;
};

export const useLogs = () => {
  const context = useContext(LogsContext);
  if (!context) {
    throw new Error("useLogs must be used within an LogsProvider");
  }
  return context;
};

export default LogsProvider;
