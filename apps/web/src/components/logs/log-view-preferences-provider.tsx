"use client";

import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TLogViewPreferencesContext = {
  preferences: string[];
  setPreferences: (preferences: ((old: string[]) => string[] | null) | string[] | null) => void;
  isDefaultState: boolean;
  resetPreferences: () => void;
};

const LogViewPreferencesContext = createContext<TLogViewPreferencesContext | null>(null);

export const logViewPreferenceKeys = {
  timestamp: "timestamp",
  serviceId: "service_id",
  lineWrapping: "line_wrapping",
  autoFollow: "auto_follow",
};

type TLogViewPreference = {
  value: string;
  label: string;
  type: "checkbox" | "default";
};

type TLogViewPreferenceGroup = {
  label: string;
  items: TLogViewPreference[];
};

export const logViewPreferences: TLogViewPreferenceGroup[] = [
  {
    label: "Columns",
    items: [
      {
        value: logViewPreferenceKeys.timestamp,
        label: "Timestamp",
        type: "checkbox",
      },
      {
        value: logViewPreferenceKeys.serviceId,
        label: "Service Name",
        type: "checkbox",
      },
    ],
  },
  {
    label: "Preferences",
    items: [
      {
        value: logViewPreferenceKeys.lineWrapping,
        label: "Line Wrapping",
        type: "checkbox",
      },
      {
        value: logViewPreferenceKeys.autoFollow,
        label: "Auto Follow",
        type: "checkbox",
      },
    ],
  },
];

const logViewPreferencesSort = (a: string, b: string) => a.localeCompare(b);

const defaultStateNormal = [
  logViewPreferenceKeys.timestamp,
  logViewPreferenceKeys.serviceId,
  logViewPreferenceKeys.autoFollow,
  logViewPreferenceKeys.lineWrapping,
].sort(logViewPreferencesSort);

const defaultStateWithoutService = [
  logViewPreferenceKeys.timestamp,
  logViewPreferenceKeys.autoFollow,
  logViewPreferenceKeys.lineWrapping,
].sort(logViewPreferencesSort);

export const logViewPreferencesKey = "log_view";

export const LogViewPreferencesProvider: React.FC<{
  children: ReactNode;
  hideServiceByDefault?: boolean;
}> = ({ hideServiceByDefault, children }) => {
  const defaultState = hideServiceByDefault ? defaultStateWithoutService : defaultStateNormal;

  // Stored in the URL as a comma-joined string (array semantics preserved here).
  const navigate = useNavigate();
  const preferencesStr = routeApi.useSearch({
    select: (s) => s[logViewPreferencesKey] ?? defaultState.join(","),
  });
  const preferences = useMemo(
    () => (preferencesStr ? preferencesStr.split(",") : []),
    [preferencesStr],
  );
  const setPreferences = useCallback(
    (next: string[] | null) =>
      navigate({
        to: ".",
        search: (prev) => ({
          ...prev,
          [logViewPreferencesKey]: next === null ? undefined : next.join(","),
        }),
        replace: true,
      }),
    [navigate],
  );

  const isDefaultState =
    preferences.sort(logViewPreferencesSort).join(",") === defaultState.join(",");

  const _setPreferences: (next: ((old: string[]) => string[] | null) | string[] | null) => void =
    useCallback(
      (next) => {
        if (next === null) {
          return setPreferences(null);
        }
        if (typeof next === "function") {
          const pref = next(preferences);
          return setPreferences(pref === null ? null : pref.sort(logViewPreferencesSort));
        }
        return setPreferences(next.sort(logViewPreferencesSort));
      },
      [setPreferences, preferences],
    );

  const resetPreferences = useCallback(() => {
    _setPreferences(defaultState);
  }, [_setPreferences, defaultState]);

  const value = useMemo(
    () => ({
      preferences,
      setPreferences: _setPreferences,
      isDefaultState,
      resetPreferences,
    }),
    [preferences, _setPreferences, isDefaultState, resetPreferences],
  );

  return (
    <LogViewPreferencesContext.Provider value={value}>
      {children}
    </LogViewPreferencesContext.Provider>
  );
};

export const useLogViewPreferences = () => {
  const context = useContext(LogViewPreferencesContext);
  if (!context) {
    throw new Error("useLogViewPreferences must be used within an LogViewPreferencesProvider");
  }
  return context;
};

export default LogViewPreferencesProvider;
