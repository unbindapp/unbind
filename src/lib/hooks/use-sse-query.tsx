import { useQuery, useQueryClient, QueryKey, UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchEventSource } from "@fortaine/fetch-event-source";
import { z } from "zod";

// A custom hook that sets up SSE with headers and integrates with Tanstack Query.
export function useSSEQuery<MessageSchema extends z.ZodTypeAny>({
  queryKey,
  sseUrl,
  headers,
  initialFetch,
  messageSchema,
}: {
  queryKey: QueryKey;
  sseUrl: string;
  headers?: Record<string, string>;
  initialFetch?: () => Promise<z.infer<MessageSchema>>;
  messageSchema: MessageSchema;
}): UseQueryResult<Array<z.infer<MessageSchema>>> {
  const queryClient = useQueryClient();

  // Use the passed in initialFetch function for the initial query
  const queryResult = useQuery<Array<z.infer<MessageSchema>>>({ queryKey, queryFn: initialFetch });

  useEffect(() => {
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
          const parsedData = messageSchema.parse(newData);
          queryClient.setQueryData(queryKey, (old: Array<z.infer<MessageSchema>>) => [
            ...(old || []),
            parsedData,
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
  }, [queryClient, queryKey, sseUrl, headers, messageSchema]);

  return queryResult;
}
