"use client";

import { useLogFilters } from "@/components/logs/log-filters-provider";
import { isEmptyLogWindow, resolveLogRange, type TLogBounds } from "@/components/logs/log-range";
import { logSearchScopes } from "@/components/logs/log-search-scope";
import { buildLogStreamUrl } from "@/components/logs/log-stream-url";
import { latestLogTimestamp, logLineKey } from "@/components/logs/log-utils";
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
  /** Live tails new lines as they land; historical is a window that can't grow. */
  mode: "live" | "historical";
  isStreamConnected: boolean;
  /** Set once the stream has given up for good and stopped retrying. */
  streamFatalError: string | null;
  streamErrorMessage: string | null;
  hasMoreOlder: boolean;
  isFetchingOlder: boolean;
  olderError: string | null;
  fetchOlder: () => void;
  searchError: string | null;
  /** Outer limits of the logs on view, when they are known to have started or ended. */
  bounds: TLogBounds;
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
  const { search, levels, serviceIds, range, rangeIsSet } = useLogFilters();
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

  const { attributeKeys } = logSearchScopes[type];
  const parsedSearch = useMemo(
    () => parseSearchInput(search, { attributeKeys, knownServiceTokens }),
    [search, attributeKeys, knownServiceTokens],
  );

  const mergedLevels = useMemo(() => {
    const merged = new Set<TLogLevel>([...levels, ...parsedSearch.levels]);
    return [...merged].sort();
  }, [levels, parsedSearch.levels]);

  // Only names this scope resolves reach here; the rest stayed in the search text.
  const mergedServiceIds = useMemo(() => {
    const merged = new Set<string>(serviceIds);
    for (const name of parsedSearch.serviceNames) {
      const service = findServiceByToken(serviceTokens, name);
      if (service) merged.add(service.id);
    }
    return [...merged].sort();
  }, [serviceIds, parsedSearch.serviceNames, serviceTokens]);

  // A @range token still sitting in the text (not yet folded into the params)
  // counts like the other merged filters; an explicit param wins.
  const effectiveRange = rangeIsSet ? range : (parsedSearch.range ?? range);
  const hasRange = rangeIsSet || parsedSearch.range !== null;

  // The default timestamps bound the window; a user range narrows it from
  // there, and without one the bounds are the window.
  const windowRange =
    !hasRange && httpDefaultStartTimestamp !== undefined
      ? { from: httpDefaultStartTimestamp }
      : effectiveRange;

  const bounds = useMemo<TLogBounds>(
    () => ({ start: httpDefaultStartTimestamp, end: httpDefaultEndTimestamp }),
    [httpDefaultStartTimestamp, httpDefaultEndTimestamp],
  );

  // Anchor the window when the range changes, not on every render.
  const rangeKey = JSON.stringify(windowRange);
  const timeWindow = useMemo(
    () => resolveLogRange(windowRange, bounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeKey, bounds],
  );

  const isLive = timeWindow.end === null;

  // An explicit range can fall entirely outside the bounds; that window is
  // empty by definition, so it is never requested.
  const rangeError = isEmptyLogWindow(timeWindow)
    ? "The time range falls outside these logs"
    : null;
  const searchError = parsedSearch.error ?? rangeError;

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
  const [olderError, setOlderError] = useState<string | null>(null);
  const [streamErrorMessage, setStreamErrorMessage] = useState<string | null>(null);

  // Where the stream resumes moves with every batch, so it is kept out of the
  // stream's identity: only a change in what the user asked for may reconnect.
  const resumeRef = useRef<string | null>(null);

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
    // the buffer holds nothing past this page now, so anything the stream
    // delivered beyond it has to be streamed again or it leaves a gap
    resumeRef.current = latestLogTimestamp(null, initialData.logs);
    setStreamErrorMessage(null);
    setOlderError(null);
  }, [initialData, initialIsPlaceholder, identityKey]);

  const bufferReady = buffer.identityKey === identityKey;

  const { apiUrl } = useAppConfig();
  const queryInputRef = useRef(queryInput);
  queryInputRef.current = queryInput;

  const streamKey = isLive && bufferReady && !searchError ? identityKey : null;
  const buildUrl = useCallback(
    () => buildLogStreamUrl(apiUrl, queryInputRef.current, resumeRef.current),
    [apiUrl],
  );

  const identityKeyRef = useRef(identityKey);
  identityKeyRef.current = identityKey;

  const evictionPausedRef = useRef(false);
  const setEvictionPaused = useCallback((paused: boolean) => {
    evictionPausedRef.current = paused;
  }, []);

  const onBatch = useCallback((batch: LogEvent[]) => {
    if (batch.length === 0) return;
    resumeRef.current = latestLogTimestamp(resumeRef.current, batch);
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

  const { isConnected: isStreamConnected, fatalError: streamFatalError } = useLogStream({
    streamKey,
    buildUrl,
    onBatch,
    onErrorEvent,
  });

  const fetchOlderRef = useRef(false);
  const fetchOlder = useCallback(async () => {
    if (fetchOlderRef.current || !bufferReady || !buffer.nextCursor) return;
    fetchOlderRef.current = true;
    setIsFetchingOlder(true);
    setOlderError(null);
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
    } catch (error) {
      // the scroll trigger stays disarmed until the user retries, so a failing
      // endpoint isn't hammered by every jiggle at the top of the list
      setOlderError(error instanceof Error ? error.message : "Failed to load older logs");
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
      mode: isLive ? "live" : "historical",
      isStreamConnected,
      streamFatalError,
      streamErrorMessage: streamErrorMessage ?? streamFatalError,
      hasMoreOlder: bufferReady && buffer.hasMoreOlder,
      isFetchingOlder,
      olderError,
      fetchOlder,
      searchError,
      bounds,
      setEvictionPaused,
    }),
    [
      logs,
      bufferReady,
      buffer,
      initialQuery.isPending,
      initialQuery.error,
      isLive,
      isStreamConnected,
      streamErrorMessage,
      streamFatalError,
      isFetchingOlder,
      olderError,
      fetchOlder,
      searchError,
      bounds,
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
