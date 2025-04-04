"use client";

import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import { CommandPanelStateProvider } from "@/components/command-panel/command-panel-state-provider";
import {
  contextCommandPanelId,
  contextCommandPanelRootPage,
} from "@/components/command-panel/constants";
import ContextCommandPanelItemsProvider, {
  useContextCommandPanelItems,
} from "@/components/command-panel/context-command-panel/context-command-panel-items-provider";
import useContextCommandPanelData from "@/components/command-panel/context-command-panel/use-context-command-panel-data";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { defaultAnimationMs } from "@/lib/constants";
import { ReactNode, useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type Props = {
  context: TContextCommandPanelContext;
  children?: ReactNode;
  idSuffix: string;
  title: string;
  description: string;
};

export default function ContextCommandPanel(props: Props) {
  return (
    <CommandPanelStateProvider>
      <ContextCommandPanel_ {...props} />
    </CommandPanelStateProvider>
  );
}

function ContextCommandPanel_({ context, idSuffix, title, description, children }: Props) {
  const { panelId, setPanelPageId, setPanelId } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const { rootPage, currentPage, setCurrentPageId, allPageIds, goToParentPage } =
    useContextCommandPanelData(context);

  const thisPanelId = `${contextCommandPanelId}_${context.contextType}_${idSuffix}`;

  const open = panelId === thisPanelId;
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const setOpen = (open: boolean) => {
    if (open) {
      setPanelId(thisPanelId);
    } else {
      setPanelId(null);
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      timeout.current = setTimeout(() => {
        setPanelPageId(null);
      }, defaultAnimationMs);
    }
  };

  useHotkeys(
    "mod+k",
    () => {
      setPanelId(thisPanelId);
    },
    {
      enabled: context.contextType === "team" || context.contextType === "project",
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  const dialogContentVariantOptions: Parameters<
    typeof CommandPanelTrigger
  >["0"]["dialogContentVariantOptions"] = useMemo(
    () => ({
      animate:
        context.contextType === "team" || context.contextType === "project" ? "none" : "default",
    }),
    [context.contextType],
  );

  return (
    <ContextCommandPanelItemsProvider
      teamId={context.teamId}
      projectId={context.projectId || ""}
      page={currentPage}
      context={context}
      idSuffix={idSuffix}
    >
      <CommandPanelTrigger
        allPageIds={allPageIds}
        currentPage={currentPage}
        title={title}
        description={description}
        goToParentPage={goToParentPage}
        setCurrentPageId={setCurrentPageId}
        rootPage={rootPage}
        useCommandPanelItems={useContextCommandPanelItems}
        dialogContentVariantOptions={dialogContentVariantOptions}
        open={open}
        setOpen={setOpen}
      >
        {children}
      </CommandPanelTrigger>
    </ContextCommandPanelItemsProvider>
  );
}
