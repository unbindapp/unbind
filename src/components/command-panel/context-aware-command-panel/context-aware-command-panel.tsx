"use client";

import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import { CommandPanelStateProvider } from "@/components/command-panel/command-panel-state-provider";
import {
  commandPanelContextAware,
  commandPanelContextAwareRootPage,
  commandPanelKey,
  commandPanelPageKey,
} from "@/components/command-panel/constants";
import ContextAwareCommandPanelItemsProvider, {
  useContextAwareCommandPanelItems,
} from "@/components/command-panel/context-aware-command-panel/context-aware-command-panel-items-provider";
import useContextAwareCommandPanelData from "@/components/command-panel/context-aware-command-panel/use-context-aware-command-panel-data";
import { TContextAwareCommandPanelContext } from "@/components/command-panel/types";
import { defaultAnimationMs } from "@/lib/constants";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type Props = {
  context: TContextAwareCommandPanelContext;
};

export default function ContextAwareCommandPanel({ context }: Props) {
  return (
    <CommandPanelStateProvider>
      <ContextAwareCommandPanel_ context={context} />
    </CommandPanelStateProvider>
  );
}

function ContextAwareCommandPanel_({ context }: Props) {
  const [commandPanelId, setCommandPanelId] = useQueryState(commandPanelKey);
  const [, setCommandPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelContextAwareRootPage),
  );

  const { rootPage, currentPage, setCurrentPageId, allPageIds, goToParentPage } =
    useContextAwareCommandPanelData(context);

  const open = commandPanelId === commandPanelContextAware;
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const setOpen = (open: boolean) => {
    if (open) {
      setCommandPanelId(commandPanelContextAware);
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
      setCommandPanelId(commandPanelContextAware);
    },
    {
      enabled: true,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  return (
    <ContextAwareCommandPanelItemsProvider
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
        useCommandPanelItems={useContextAwareCommandPanelItems}
        dialogContentVariantOptions={{ animate: "none" }}
        open={open}
        setOpen={setOpen}
      />
    </ContextAwareCommandPanelItemsProvider>
  );
}
