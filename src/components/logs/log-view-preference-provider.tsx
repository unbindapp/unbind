"use client";

import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { createContext, ReactNode, useContext } from "react";

type TLogViewPreferencesContext = {
  preferences: string[];
  setPreferences: (
    preferences: ((old: string[]) => string[] | null) | string[] | null
  ) => void;
};

const LogViewPreferencesContext =
  createContext<TLogViewPreferencesContext | null>(null);

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
        value: logViewPreferenceKeys.autoFollow,
        label: "Auto Follow",
        type: "checkbox",
      },
      {
        value: logViewPreferenceKeys.lineWrapping,
        label: "Line Wrapping",
        type: "checkbox",
      },
    ],
  },
];

const logViewPreferenceSort = (a: string, b: string) => a.localeCompare(b);

export const LogViewPreferencesProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [preferences, setPreferences] = useQueryState(
    "preferences",
    parseAsArrayOf(parseAsString).withDefault(
      [
        logViewPreferenceKeys.timestamp,
        logViewPreferenceKeys.serviceId,
        logViewPreferenceKeys.autoFollow,
      ].sort(logViewPreferenceSort)
    )
  );

  const _setPreferences: (
    preferences: ((old: string[]) => string[] | null) | string[] | null
  ) => void = (preferences) => {
    if (preferences === null) {
      return setPreferences(null);
    }
    if (typeof preferences === "function") {
      return setPreferences((old) => {
        const pref = preferences(old);
        if (pref === null) {
          return null;
        }
        return pref.sort(logViewPreferenceSort);
      });
    }
    return setPreferences(preferences.sort(logViewPreferenceSort));
  };

  return (
    <LogViewPreferencesContext.Provider
      value={{
        preferences,
        setPreferences: _setPreferences,
      }}
    >
      {children}
    </LogViewPreferencesContext.Provider>
  );
};

export const useLogViewPreferences = () => {
  const context = useContext(LogViewPreferencesContext);
  if (!context) {
    throw new Error(
      "useLogViewPreferences must be used within an LogViewPreferencesProvider"
    );
  }
  return context;
};

export default LogViewPreferencesProvider;
