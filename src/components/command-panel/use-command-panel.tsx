import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import { defaultAnimationMs } from "@/lib/constants";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useRef } from "react";

export default function useCommandPanel({ defaultPageId }: { defaultPageId: string }) {
  const [panelId, setPanelId] = useQueryState(commandPanelKey);
  const [panelPageId, setPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(defaultPageId),
  );
  const timeout = useRef<NodeJS.Timeout | null>(null);

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
        }, defaultAnimationMs);
      },
    }),
    [panelId, setPanelId, panelPageId, setPanelPageId],
  );

  return value;
}
