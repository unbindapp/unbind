import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { defaultAnimationMs } from "@/lib/constants";
import { useSearchParam } from "@/lib/hooks/use-search-param";
import { useMemo, useRef } from "react";

export default function useCommandPanel({ defaultPageId }: { defaultPageId: string }) {
  const [panelId, setPanelId] = useSearchParam(commandPanelKey);
  const [panelPageId, setPanelPageId] = useSearchParam(commandPanelPageKey, defaultPageId);
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
