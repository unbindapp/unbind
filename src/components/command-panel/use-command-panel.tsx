import {
  commandPanelContextAwareRootPage,
  commandPanelKey,
  commandPanelPageKey,
} from "@/components/command-panel/constants";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";

export default function useCommandPanel() {
  const [panelId, setPanelId] = useQueryState(commandPanelKey);
  const [panelPageId, setPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelContextAwareRootPage),
  );
  const value = useMemo(
    () => ({
      panelId,
      setPanelId,
      panelPageId,
      setPanelPageId,
    }),
    [panelId, setPanelId, panelPageId, setPanelPageId],
  );

  return value;
}
