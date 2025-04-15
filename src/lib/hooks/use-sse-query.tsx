import { fetchEventSource } from "@fortaine/fetch-event-source";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import pRetry from "p-retry";

type TProps<T extends z.ZodType<any>> = {
  url: string;
  accessToken: string;
  disabled?: boolean;
  filter?: (obj: z.infer<T>) => boolean;
  parser: T;
};

export default function useSSEQuery<T extends z.ZodType<any>>(props: TProps<T>) {
  const { url, accessToken, disabled } = props;

  const [data, setData] = useState<z.infer<T>[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs for the current AbortController and component mount status.
  const controllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Persist props in a ref for callbacks that outlive render cycles.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  // Set up mount status and ensure we abort pending connections on unmount.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  // Cleanup function: abort any current SSE connection and update state.
  const cleanup = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    if (isMountedRef.current) {
      setIsConnected(false);
    }
  }, []);

  // Initialize SSE connection with a retry mechanism.
  const initConnection = useCallback(() => {
    // Clean up any existing connection first.
    cleanup();

    // Do not connect if disabled.
    if (propsRef.current.disabled) return;

    // Reset any previous error.
    if (isMountedRef.current) {
      setError(null);
    }

    const connect = async () => {
      if (!isMountedRef.current) {
        console.log("Component unmounted during retry");
        return;
      }

      // Create a new AbortController for this connection attempt.
      const controller = new AbortController();
      controllerRef.current = controller;

      // Get the latest props.
      const { url, accessToken, filter, parser } = propsRef.current;

      return new Promise((resolve, reject) => {
        fetchEventSource(url, {
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
          onopen: async () => {
            if (isMountedRef.current) {
              setIsConnected(true);
              resolve(true);
            }
          },
          onmessage: (event) => {
            if (!isMountedRef.current) return;

            try {
              const newData = JSON.parse(event.data);
              if (filter && !filter(newData)) return;

              const result = parser.safeParse(newData);
              if (result.success) {
                setData((prev) => (prev ? [...prev, result.data] : [result.data]));
              }
            } catch (err) {
              console.error("Error parsing SSE message:", err);
            }
          },
          onerror: (err) => {
            // Ignore errors if already aborted or unmounted.
            if (!isMountedRef.current || controller.signal.aborted) return;
            setIsConnected(false);
            reject(err);
          },
          onclose: () => {
            if (!isMountedRef.current) return;
            setIsConnected(false);
            if (!controller.signal.aborted) {
              reject(new Error("Connection closed unexpectedly"));
            }
          },
        }).catch(reject);
      });
    };

    // Use pRetry to retry the connection a few times.
    pRetry(connect, {
      retries: 3,
      minTimeout: 500,
      factor: 2,
      onFailedAttempt: (error) => {
        if (isMountedRef.current) {
          console.log(
            `Connection attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
          );
        }
      },
    }).catch((err) => {
      if (err.name === "AbortError" || !isMountedRef.current) return;
      console.error("All connection attempts failed:", err);
      if (isMountedRef.current) {
        setError(err);
      }
    });
  }, [cleanup]);

  // Whenever the URL, token, or disabled status changes, (re)initialize the connection.
  useEffect(() => {
    initConnection();
    return cleanup;
  }, [url, accessToken, disabled, initConnection, cleanup]);

  return {
    data,
    error,
    isConnected,
    isPending: !isConnected && !error && !disabled,
  };
}
