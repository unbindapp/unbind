"use client";

import { useLogViewState } from "@/components/logs/log-view-state-provider";
import { createSearchFilter } from "@/components/logs/search-filter";
import { env } from "@/lib/env";
import { LogEventSchema } from "@/server/go/client.gen";
import { AppRouterInputs, AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { fetchEventSource } from "@fortaine/fetch-event-source";
import { useSession } from "next-auth/react";
import { createContext, ReactNode, useContext, useEffect, useMemo } from "react";
import { z } from "zod";

type TLogsContext = AppRouterQueryResult<AppRouterOutputs["logs"]["list"]> & {};

const LogsContext = createContext<TLogsContext | null>(null);

export type TLogLine = z.infer<typeof LogEventSchema>;

export const MessageSchema = z.object({ logs: LogEventSchema.array() }).strip();
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
  const since = "24h";

  const [queryProps, urlParams] = useMemo(() => {
    const props: AppRouterInputs["logs"]["list"] = {
      type,
      teamId,
      projectId,
      environmentId,
      serviceId,
      filters: filtersStr,
      since,
    };
    const params = new URLSearchParams({
      team_id: props.teamId,
      project_id: props.projectId || "",
      environment_id: props.environmentId || "",
      type: props.type,
      since: props.since || "",
    });
    if (type === "service") {
      params.set("service_id", serviceId);
    }
    if (filtersStr) {
      params.set("filters", filtersStr);
    }
    return [props, params];
  }, [teamId, projectId, environmentId, serviceId, type, filtersStr]);

  const sseUrl = `${env.NEXT_PUBLIC_UNBIND_API_URL}/logs/stream?${urlParams.toString()}`;

  const utils = api.useUtils();
  const queryResult = api.logs.list.useQuery(queryProps);

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
          if (newData.type !== "log") {
            return;
          }
          const parsedData = MessageSchema.parse(newData);
          utils.logs.list.setData(queryProps, (old) => {
            const newLogs = parsedData.logs.filter(
              (l) => !old?.logs.some((o) => o.timestamp === l.timestamp),
            );
            const finalArray: AppRouterOutputs["logs"]["list"]["logs"] = [
              ...(old?.logs || []),
              ...newLogs,
            ];
            return { ...old, logs: finalArray };
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
  }, [sseUrl, session, queryProps]);

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
