import { fetchEventSource } from "@fortaine/fetch-event-source";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TProps<T extends z.ZodType<any>> = {
  url: string;
  accessToken: string;
  disabled?: boolean;
  filter?: (obj: z.infer<T>) => boolean;
  parser: T;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function useSSEQuery<T extends z.ZodType<any>>(props: TProps<T>) {
  const [data, setData] = useState<z.infer<T>[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const pathname = usePathname();

  const queryKey = stableHash(props);
  const queryKeyRef = useRef(queryKey);

  const propsRef = useRef(props);
  propsRef.current = props;

  const controller = useRef<AbortController>(new AbortController());
  const streamInitTimeout = useRef<NodeJS.Timeout | null>(null);

  const initSSEConnection = useCallback(() => {
    setError(null);
    setData(null);

    const { url, accessToken, filter, parser } = propsRef.current;

    if (controller.current) {
      controller.current.abort();
    }
    controller.current = new AbortController();

    fetchEventSource(url, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.current.signal,
      onmessage: (event) => {
        try {
          const newData = JSON.parse(event.data);

          if (filter && !filter(newData)) return;

          const { success, data: parsedData } = parser.safeParse(newData);

          if (success) {
            setData((old) => {
              const updatedLogs = old ? [...old, parsedData] : [parsedData];
              return updatedLogs;
            });
          }
        } catch (error) {
          setError(new Error("Failed to parse SSE data"));
          console.error("Error parsing SSE data:", error);
        }
      },
      onerror: (error) => {
        console.error("SSE connection error:", error);
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setError(error);
        }
        if (streamInitTimeout.current) {
          clearTimeout(streamInitTimeout.current);
        }
        streamInitTimeout.current = setTimeout(() => {
          initSSEConnection();
        }, 2000);
      },
    });
  }, []);

  useEffect(() => {
    return () => {
      queryKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    if (queryKey !== queryKeyRef.current) {
      queryKeyRef.current = queryKey;

      if (!props.disabled) {
        initSSEConnection();
      }
    }

    return () => {
      if (controller.current) {
        controller.current.abort();
      }
      if (streamInitTimeout.current) {
        clearTimeout(streamInitTimeout.current);
      }
    };
  }, [queryKey, initSSEConnection, props.disabled, pathname]);

  const value = useMemo(() => ({ data, error, isPending: !data && !error }), [data, error]);
  return value;
}

function stableHash(obj: unknown): string {
  return JSON.stringify(obj, (_, val) =>
    typeof val === "function"
      ? val.toString()
      : val instanceof z.ZodType
        ? val._def.typeName
        : Array.isArray(val)
          ? [...val].sort()
          : val,
  );
}
