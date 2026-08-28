"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

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

export const LogViewPreferencesProvider: React.FC<{
  children: ReactNode;
  storageKey: string;
  hideServiceByDefault?: boolean;
}> = ({ storageKey, hideServiceByDefault, children }) => {
  const defaultState = hideServiceByDefault ? defaultStateWithoutService : defaultStateNormal;

  const [preferences, setStored] = useLocalStorage<string[]>(
    `log-view-prefs:${storageKey}`,
    defaultState,
  );

  const setPreferences = useCallback(
    (next: ((old: string[]) => string[] | null) | string[] | null) => {
      setStored((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved === null) return defaultState;
        return resolved.toSorted(logViewPreferencesSort);
      });
    },
    [setStored, defaultState],
  );

  const resetPreferences = useCallback(() => {
    setStored(defaultState);
  }, [setStored, defaultState]);

  const isDefaultState =
    preferences.toSorted(logViewPreferencesSort).join(",") === defaultState.join(",");

  const value = useMemo(
    () => ({
      preferences,
      setPreferences,
      isDefaultState,
      resetPreferences,
    }),
    [preferences, setPreferences, isDefaultState, resetPreferences],
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
