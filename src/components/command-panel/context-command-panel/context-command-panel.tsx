"use client";

import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import { CommandPanelStateProvider } from "@/components/command-panel/command-panel-state-provider";
import {
  commandPanelKey,
  commandPanelPageKey,
  contextCommandPanelId,
  contextCommandPanelRootPage,
} from "@/components/command-panel/constants";
import ContextCommandPanelItemsProvider, {
  useContextCommandPanelItems,
} from "@/components/command-panel/context-command-panel/context-command-panel-items-provider";
import useContextCommandPanelData from "@/components/command-panel/context-command-panel/use-context-command-panel-data";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import { defaultAnimationMs } from "@/lib/constants";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type Props = {
  context: TContextCommandPanelContext;
};

export default function ContextCommandPanel({ context }: Props) {
  return (
    <CommandPanelStateProvider>
      <ContextCommandPanel_ context={context} />
    </CommandPanelStateProvider>
  );
}

function ContextCommandPanel_({ context }: Props) {
  const [commandPanelId, setCommandPanelId] = useQueryState(commandPanelKey);
  const [, setCommandPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(contextCommandPanelRootPage),
  );

  const { rootPage, currentPage, setCurrentPageId, allPageIds, goToParentPage } =
    useContextCommandPanelData(context);

  const open = commandPanelId === contextCommandPanelId;
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const setOpen = (open: boolean) => {
    if (open) {
      setCommandPanelId(contextCommandPanelId);
    } else {
      setCommandPanelId(null);
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      timeout.current = setTimeout(() => {
        setCommandPanelPageId(null);
      }, defaultAnimationMs);
    }
  };

  useHotkeys(
    "mod+k",
    () => {
      setCommandPanelId(contextCommandPanelId);
    },
    {
      enabled: true,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  const dialogContentVariantOptions: Parameters<
    typeof CommandPanelTrigger
  >["0"]["dialogContentVariantOptions"] = useMemo(
    () => ({
      animate:
        context.contextType === "new-project" || context.contextType === "new-service"
          ? "default"
          : "none",
    }),
    [context.contextType],
  );

  return (
    <ContextCommandPanelItemsProvider
      teamId={context.teamId}
      projectId={context.projectId || ""}
      page={currentPage}
    >
      <CommandPanelTrigger
        allPageIds={allPageIds}
        currentPage={currentPage}
        title="Command Panel"
        description="Access features of Unbind with ease."
        goToParentPage={goToParentPage}
        setCurrentPageId={setCurrentPageId}
        rootPage={rootPage}
        useCommandPanelItems={useContextCommandPanelItems}
        dialogContentVariantOptions={dialogContentVariantOptions}
        open={open}
        setOpen={setOpen}
      />
    </ContextCommandPanelItemsProvider>
  );
}
