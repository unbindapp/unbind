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
  })
  .strip();
export type TLogLine = z.infer<typeof LogLineSchema>;

export const MessageSchema = z.object({ logs: LogLineSchema.array() });
export type TMessage = z.infer<typeof MessageSchema>;

export function useLogs({ sseUrl, headers, enabled }: TProps) {
  const queryClient = useQueryClient();
  const queryKey: QueryKey = useMemo(() => ["logs", sseUrl], [sseUrl]);

  // Use the passed in initialFetch function for the initial query
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
      onmessage(event) {
        try {
          const newData = JSON.parse(event.data);
          const parsedData = MessageSchema.parse(newData);
          queryClient.setQueryData(queryKey, (old: TLogLine[]) => [
            ...(old || []),
            ...parsedData.logs,
          ]);
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      },
      onerror(error) {
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
