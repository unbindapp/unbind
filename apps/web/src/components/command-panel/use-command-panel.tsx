import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { defaultAnimationMs } from "@/lib/constants";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef } from "react";

// Command panel params live on the root route — it renders across both the team
// and project areas, so root is their only common ancestor.
const routeApi = getRouteApi("__root__");

export default function useCommandPanel({ defaultPageId }: { defaultPageId: string }) {
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const panelId = search[commandPanelKey] ?? null;
  const panelPageId = search[commandPanelPageKey] ?? defaultPageId;
  const setPanelId = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [commandPanelKey]: value ?? undefined }),
        replace: true,
      }),
    [navigate],
  );
  const setPanelPageId = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [commandPanelPageKey]: value ?? undefined }),
        replace: true,
      }),
    [navigate],
  );
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const clearInputValue = useCommandPanelStore((s) => s.clearInputValue);

  const value = useMemo(
    () => ({
      panelId,
      setPanelId,
      panelPageId,
      setPanelPageId,
      closePanel: () => {
        setPanelId(null);
        if (timeout.current) {
          clearTimeout(timeout.current);
        }
        timeout.current = setTimeout(() => {
          setPanelPageId(null);
          clearInputValue(panelPageId);
        }, defaultAnimationMs);
      },
    }),
    [panelId, setPanelId, panelPageId, setPanelPageId, clearInputValue],
  );

  return value;
}
