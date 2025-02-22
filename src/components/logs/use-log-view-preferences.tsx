import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";

export const logViewPreferenceKeys = {
  timestamp: "timestamp",
  serviceId: "service_id",
  lineWrapping: "line_wrapping",
};

const logViewPreferenceSort = (a: string, b: string) => a.localeCompare(b);

export default function useLogViewPreferences() {
  const [preferences, setPreferences] = useQueryState(
    "preferences",
    parseAsArrayOf(parseAsString).withDefault(
      [
        logViewPreferenceKeys.timestamp,
        logViewPreferenceKeys.serviceId,
        logViewPreferenceKeys.lineWrapping,
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

  return [preferences, _setPreferences] as const;
}
