import { fetchEventSource } from "@fortaine/fetch-event-source";
import { QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { z } from "zod";

type TProps = {
  sseUrl: string;
  headers?: Record<string, string>;
  enabled?: boolean;
};

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

export function useLogs({ sseUrl, headers, enabled }: TProps) {
  const queryClient = useQueryClient();
  const queryKey: QueryKey = useMemo(() => ["logs", sseUrl], [sseUrl]);

  const queryResult = useQuery<TLogLine[]>({ queryKey });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    fetchEventSource(sseUrl, {
      headers: {
        Accept: "text/event-stream",
        ...(headers || {}),
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
  }, [queryClient, queryKey, sseUrl, headers, enabled]);

  return queryResult;
}
