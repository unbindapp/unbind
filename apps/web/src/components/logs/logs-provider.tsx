"use client";

import { useLogFilters } from "@/components/logs/log-filters-provider";
import { defaultLogRange, isLiveRange, resolveLogRange } from "@/components/logs/log-range";
import { logLineKey } from "@/components/logs/log-utils";
import { parseSearchInput } from "@/components/logs/search-syntax";
import { buildServiceTokens, findServiceByToken } from "@/components/logs/service-tokens";
import { useServices } from "@/components/service/services-provider";
import { useAppConfig } from "@/components/providers/app-config-provider";
import useLogStream from "@/lib/hooks/use-log-stream";
import {
  fetchLogsPage,
  logsListQuery,
  type TLogLevel,
  type TLogLine,
  type TLogType,
} from "@/lib/queries/logs";
import type { LogEvent } from "@/lib/server/client.gen";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  createContext,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

const MAX_BUFFER_LINES = 10_000;

export type TBufferedLogLine = TLogLine & { key: string };

type TBufferState = {
  identityKey: string | null;
  lines: TBufferedLogLine[];
  keys: Set<string>;
  nextCursor: string | undefined;
  hasMoreOlder: boolean;
};

const emptyBuffer: TBufferState = {
  identityKey: null,
  lines: [],
  keys: new Set(),
  nextCursor: undefined,
  hasMoreOlder: false,
};

function withKeys(lines: TLogLine[], seen: Set<string>): TBufferedLogLine[] {
  const fresh: TBufferedLogLine[] = [];
  for (const line of lines) {
    const key = logLineKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push({ ...line, key });
  }
  return fresh;
}

type TBufferAction =
  | {
      type: "reset";
      identityKey: string;
      lines: TLogLine[];
      nextCursor: string | undefined;
    }
  | { type: "append"; identityKey: string; batch: TLogLine[]; allowTrim: boolean }
  | { type: "prepend"; identityKey: string; lines: TLogLine[]; nextCursor: string | undefined };

function bufferReducer(state: TBufferState, action: TBufferAction): TBufferState {
  switch (action.type) {
    case "reset": {
      const keys = new Set<string>();
      const lines = withKeys(action.lines, keys);
      return {
        identityKey: action.identityKey,
        lines,
        keys,
        nextCursor: action.nextCursor,
        hasMoreOlder: Boolean(action.nextCursor),
      };
    }
    case "append": {
      if (state.identityKey !== action.identityKey) return state;
      const keys = new Set(state.keys);
      const fresh = withKeys(action.batch, keys);
      if (fresh.length === 0) return state;

      let lines = [...state.lines, ...fresh];

      let nextCursor = state.nextCursor;
      let hasMoreOlder = state.hasMoreOlder;
      // trimming is skipped while the user reads history so eviction can't
      // fight the pages they just scrolled up to
      if (action.allowTrim && lines.length > MAX_BUFFER_LINES) {
        const trimmed = lines.slice(0, lines.length - MAX_BUFFER_LINES);
        lines = lines.slice(lines.length - MAX_BUFFER_LINES);
        for (const line of trimmed) keys.delete(line.key);
        const oldest = lines[0];
        if (oldest?.timestamp) {
          // evicted lines are reachable again through the query endpoint
          nextCursor = oldest.timestamp;
          hasMoreOlder = true;
        }
      }

      return { ...state, lines, keys, nextCursor, hasMoreOlder };
    }
    case "prepend": {
      if (state.identityKey !== action.identityKey) return state;
      const keys = new Set(state.keys);
      const fresh = withKeys(action.lines, keys);
      // an all-duplicate page with an unchanged cursor would loop forever
      if (fresh.length === 0 && action.nextCursor === state.nextCursor) {
        return { ...state, hasMoreOlder: false };
      }
      return {
        ...state,
        lines: fresh.length ? [...fresh, ...state.lines] : state.lines,
        keys,
        nextCursor: action.nextCursor,
        hasMoreOlder: Boolean(action.nextCursor),
      };
    }
  }
}

type TLogsContext = {
  logs: TBufferedLogLine[] | null;
  logsRef: RefObject<TBufferedLogLine[] | null>;
  /** Changes only when a new set of filters seeds the buffer. */
  resultSetKey: string | null;
  isPending: boolean;
  isRefreshing: boolean;
  error: Error | null;
  streamStatus: "idle" | "connecting" | "live" | "reconnecting" | "error";
  streamErrorMessage: string | null;
  isLive: boolean;
  hasMoreOlder: boolean;
  isFetchingOlder: boolean;
  fetchOlder: () => void;
  searchError: string | null;
  setEvictionPaused: (paused: boolean) => void;
};

const LogsContext = createContext<TLogsContext | null>(null);

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

export type TDeploymentBuildLogsProps = {
  type: "build";
  environmentId: string;
  serviceId: string;
  deploymentId: string;
};

type TProps = TBaseProps &
  (TEnvironmentLogsProps | TServiceLogsProps | TDeploymentLogsProps | TDeploymentBuildLogsProps);

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
  const { search, levels, serviceIds, range, servicesEnabled } = useLogFilters();
  const {
    query: { data: servicesData },
  } = useServices();

  const serviceTokens = useMemo(
    () => buildServiceTokens(servicesData?.services ?? []),
    [servicesData],
  );
  // Left undefined until the list loads so a real name isn't briefly demoted to
  // a plain search term while the query is in flight.
  const knownServiceTokens = useMemo(
    () => (servicesData ? new Set(serviceTokens.map((t) => t.token.toLowerCase())) : undefined),
    [servicesData, serviceTokens],
  );

  const parsedSearch = useMemo(
    () => parseSearchInput(search, knownServiceTokens),
    [search, knownServiceTokens],
  );

  const mergedLevels = useMemo(() => {
    const merged = new Set<TLogLevel>([...levels, ...parsedSearch.levels]);
    return [...merged].sort();
  }, [levels, parsedSearch.levels]);

  const { mergedServiceIds, serviceNameError } = useMemo(() => {
    if (parsedSearch.serviceNames.length > 0 && !servicesEnabled) {
      return {
        mergedServiceIds: [...serviceIds].sort(),
        serviceNameError: "@service is only available in environment logs",
      };
    }
    // Only names that resolve reach here; the rest stayed in the search text.
    const merged = new Set<string>(serviceIds);
    for (const name of parsedSearch.serviceNames) {
      const service = findServiceByToken(serviceTokens, name);
      if (service) merged.add(service.id);
    }
    return { mergedServiceIds: [...merged].sort(), serviceNameError: null };
  }, [serviceIds, parsedSearch.serviceNames, serviceTokens, servicesEnabled]);

  const searchError = parsedSearch.error ?? serviceNameError;

  // Anchor the window when the range changes, not on every render.
  const rangeKey = JSON.stringify(range);
  const explicitWindow = Boolean(httpDefaultStartTimestamp || httpDefaultEndTimestamp);
  const timeWindow = useMemo(() => {
    if (explicitWindow) {
      return {
        start: httpDefaultStartTimestamp
          ? new Date(httpDefaultStartTimestamp).toISOString()
          : resolveLogRange(defaultLogRange).start,
        end: httpDefaultEndTimestamp ? new Date(httpDefaultEndTimestamp).toISOString() : null,
      };
    }
    return resolveLogRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, explicitWindow, httpDefaultStartTimestamp, httpDefaultEndTimestamp]);

  const isLive = explicitWindow ? !httpDefaultEndTimestamp : isLiveRange(range);

  const queryInput = useMemo(
    () => ({
      type,
      teamId,
      projectId,
      environmentId,
      serviceId,
      deploymentId,
      search: parsedSearch.serverSearch || undefined,
      levels: mergedLevels.length ? mergedLevels.join(",") : undefined,
      serviceIds: mergedServiceIds.length ? mergedServiceIds.join(",") : undefined,
      start: timeWindow.start,
      end: timeWindow.end ?? undefined,
    }),
    [
      type,
      teamId,
      projectId,
      environmentId,
      serviceId,
      deploymentId,
      parsedSearch.serverSearch,
      mergedLevels,
      mergedServiceIds,
      timeWindow,
    ],
  );

  const identityKey = useMemo(() => JSON.stringify(queryInput), [queryInput]);

  const initialQuery = useQuery({
    ...logsListQuery(queryInput),
    enabled: !searchError,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const [buffer, dispatch] = useReducer(bufferReducer, emptyBuffer);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [streamErrorMessage, setStreamErrorMessage] = useState<string | null>(null);

  // Seed/replace the buffer whenever the initial page for the current
  // identity lands; stale identities keep rendering until then.
  const initialData = initialQuery.data;
  const initialIsPlaceholder = initialQuery.isPlaceholderData;
  useEffect(() => {
    if (!initialData || initialIsPlaceholder) return;
    dispatch({
      type: "reset",
      identityKey,
      lines: initialData.logs,
      nextCursor: initialData.nextCursor,
    });
    setStreamErrorMessage(null);
  }, [initialData, initialIsPlaceholder, identityKey]);

  const bufferReady = buffer.identityKey === identityKey;

  const { apiUrl } = useAppConfig();
  const streamUrl = useMemo(() => {
    if (!isLive || !bufferReady || searchError) return null;
    const params = new URLSearchParams({
      type,
      team_id: teamId,
      project_id: projectId || "",
      environment_id: environmentId || "",
    });
    if (type === "service" || type === "deployment") params.set("service_id", serviceId);
    if (type === "deployment" || type === "build") params.set("deployment_id", deploymentId);
    if (parsedSearch.serverSearch) params.set("search", parsedSearch.serverSearch);
    if (mergedLevels.length) params.set("levels", mergedLevels.join(","));
    if (mergedServiceIds.length) params.set("service_ids", mergedServiceIds.join(","));
    // resume right where the initial page ended; overlap is deduped by key
    const newest = buffer.lines[buffer.lines.length - 1]?.timestamp;
    params.set("start", newest ?? timeWindow.start);
    return `${apiUrl}/logs/stream?${params.toString()}`;
    // the buffer's newest line only matters at connect time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLive,
    bufferReady,
    searchError,
    type,
    teamId,
    projectId,
    environmentId,
    serviceId,
    deploymentId,
    parsedSearch.serverSearch,
    mergedLevels,
    mergedServiceIds,
    timeWindow.start,
    apiUrl,
    identityKey,
  ]);

  const identityKeyRef = useRef(identityKey);
  identityKeyRef.current = identityKey;

  const evictionPausedRef = useRef(false);
  const setEvictionPaused = useCallback((paused: boolean) => {
    evictionPausedRef.current = paused;
  }, []);

  const onBatch = useCallback((batch: LogEvent[]) => {
    if (batch.length === 0) return;
    dispatch({
      type: "append",
      identityKey: identityKeyRef.current,
      batch,
      allowTrim: !evictionPausedRef.current,
    });
    setStreamErrorMessage(null);
  }, []);

  const onErrorEvent = useCallback((message: string) => {
    setStreamErrorMessage(message);
  }, []);

  const { status: streamStatus, error: streamFatalError } = useLogStream({
    url: streamUrl,
    onBatch,
    onErrorEvent,
  });

  const fetchOlderRef = useRef(false);
  const fetchOlder = useCallback(async () => {
    if (fetchOlderRef.current || !bufferReady || !buffer.nextCursor) return;
    fetchOlderRef.current = true;
    setIsFetchingOlder(true);
    // tie the page to the identity it was requested for, so a filter change
    // mid-flight can't leak the wrong logs into the fresh buffer
    const requestIdentityKey = identityKey;
    const cursor = buffer.nextCursor;
    try {
      const page = /^\d+$/.test(cursor)
        ? await fetchLogsPage({ ...queryInput, cursor })
        : // eviction-minted cursors are raw timestamps; end is exclusive too
          await fetchLogsPage({ ...queryInput, end: cursor });
      dispatch({
        type: "prepend",
        identityKey: requestIdentityKey,
        lines: page.logs,
        nextCursor: page.nextCursor,
      });
    } catch {
      // scrolling up again retries
    } finally {
      fetchOlderRef.current = false;
      setIsFetchingOlder(false);
    }
  }, [bufferReady, buffer.nextCursor, queryInput, identityKey]);

  const logsRef = useRef<TBufferedLogLine[] | null>(null);
  const logs = buffer.identityKey !== null ? buffer.lines : null;
  logsRef.current = logs;

  const value: TLogsContext = useMemo(
    () => ({
      logs,
      logsRef,
      resultSetKey: buffer.identityKey,
      isPending: buffer.identityKey === null && initialQuery.isPending,
      isRefreshing: !bufferReady && buffer.identityKey !== null,
      error: initialQuery.error,
      streamStatus,
      streamErrorMessage: streamErrorMessage ?? streamFatalError,
      isLive,
      hasMoreOlder: bufferReady && buffer.hasMoreOlder,
      isFetchingOlder,
      fetchOlder,
      searchError,
      setEvictionPaused,
    }),
    [
      logs,
      bufferReady,
      buffer,
      initialQuery.isPending,
      initialQuery.error,
      streamStatus,
      streamErrorMessage,
      streamFatalError,
      isLive,
      isFetchingOlder,
      fetchOlder,
      searchError,
      setEvictionPaused,
    ],
  );

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
