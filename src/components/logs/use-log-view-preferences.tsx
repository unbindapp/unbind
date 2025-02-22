import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";

export const logViewPreferenceKeys = {
  lineWrapping: "line_wrapping",
  timestamp: "timestamp",
  serviceId: "service_id",
};

export default function useLogViewPreferences() {
  const [preferences, setPreferences] = useQueryState(
    "preferences",
    parseAsArrayOf(parseAsString).withDefault([
      logViewPreferenceKeys.timestamp,
      logViewPreferenceKeys.serviceId,
      logViewPreferenceKeys.lineWrapping,
    ])
  );

  const _setPreferences: typeof setPreferences = (params, options) => {
    if (typeof params === "function" || params === null) {
      return setPreferences(params, options);
    }
    return setPreferences(
      params.sort((a, b) => a.localeCompare(b)),
      options
    );
  };

  return [preferences, _setPreferences] as const;
}
