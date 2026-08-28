"use client";

import { LogEventsSchema, type LogEvent } from "@/lib/server/client.gen";
import { fetchEventSource } from "@fortaine/fetch-event-source";
import { useEffect, useRef, useState } from "react";

export type TLogStreamStatus = "idle" | "connecting" | "live" | "reconnecting" | "error";

type TProps = {
  url: string | null;
  onBatch: (logs: LogEvent[]) => void;
  onErrorEvent: (message: string) => void;
};

const initialRetryMs = 1000;
const maxRetryMs = 30_000;

class RetriableStreamError extends Error {}
class FatalStreamError extends Error {}

// A single long-lived SSE connection that retries forever with backoff.
// fetch-event-source tracks the server's `id:` field and resends it as
// Last-Event-Id on every retry, so reconnects resume instead of replaying.
export default function useLogStream({ url, onBatch, onErrorEvent }: TProps) {
  const [status, setStatus] = useState<TLogStreamStatus>(url ? "connecting" : "idle");
  const [error, setError] = useState<string | null>(null);

  const callbacksRef = useRef({ onBatch, onErrorEvent });
  useEffect(() => {
    callbacksRef.current = { onBatch, onErrorEvent };
  }, [onBatch, onErrorEvent]);

  useEffect(() => {
    if (!url) {
      setStatus("idle");
      setError(null);
      return;
    }

    const controller = new AbortController();
    let retryMs = initialRetryMs;
    setStatus("connecting");
    setError(null);

    fetchEventSource(url, {
      credentials: "include",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
      onopen: async (response) => {
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType?.startsWith("text/event-stream")) {
          const body = await response.text().catch(() => "");
          const detail = `${response.status} (${contentType ?? "no content-type"}): ${body}`;
          // auth/permission failures won't heal by retrying — surface them
          if ([401, 403, 404].includes(response.status)) {
            throw new FatalStreamError(`Live stream stopped — ${detail}`);
          }
          throw new RetriableStreamError(`SSE ${detail}`);
        }
        retryMs = initialRetryMs;
        if (!controller.signal.aborted) setStatus("live");
      },
      onmessage: (event) => {
        if (controller.signal.aborted || !event.data) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        const result = LogEventsSchema.safeParse(parsed);
        if (!result.success) return;
        if (result.data.type === "error") {
          callbacksRef.current.onErrorEvent(result.data.error_message || "Log stream error");
          return;
        }
        callbacksRef.current.onBatch(result.data.logs ?? []);
      },
      onclose: () => {
        // the server never closes a healthy stream; treat closes as retriable
        throw new RetriableStreamError("Connection closed unexpectedly");
      },
      onerror: (err) => {
        if (controller.signal.aborted) return;
        if (err instanceof FatalStreamError) {
          setStatus("error");
          setError(err.message);
          throw err;
        }
        setStatus("reconnecting");
        const delay = retryMs;
        retryMs = Math.min(retryMs * 2, maxRetryMs);
        return delay;
      },
    }).catch(() => {
      // reachable on abort or a fatal error (state already set above)
    });

    return () => {
      controller.abort();
    };
  }, [url]);

  return { status, error };
}
