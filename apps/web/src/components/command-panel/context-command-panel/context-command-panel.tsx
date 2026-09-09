"use client";

import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import { CommandPanelItemsProvider } from "@/components/command-panel/command-panel-items-provier";
import {
  contextCommandPanelId,
  contextCommandPanelRootPage,
} from "@/components/command-panel/constants";
import ContextCommandPanelItemsProvider, {
  useContextCommandPanelItems,
} from "@/components/command-panel/context-command-panel/context-command-panel-items-provider";
import useContextCommandPanelData from "@/components/command-panel/context-command-panel/use-context-command-panel-data";
import { CommandPanelStoreProvider } from "@/components/command-panel/store/command-panel-store-provider";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useHotkey } from "@tanstack/react-hotkeys";
import { ReactElement, useMemo } from "react";
import { z } from "zod";

export const TriggerTypeEnum = z.enum(["layout", "button", "list"]);
type TTriggerType = z.infer<typeof TriggerTypeEnum>;

type TProps = {
  context: TContextCommandPanelContext;
  children?: ReactElement;
  triggerType: TTriggerType;
  title: string;
  description: string;
};

export default function ContextCommandPanel(props: TProps) {
  return (
    <CommandPanelStoreProvider>
      <ContextCommandPanel_ {...props} />
    </CommandPanelStoreProvider>
  );
}

function ContextCommandPanel_({ context, triggerType, title, description, children }: TProps) {
  const { panelId, setPanelId } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const { rootPage, currentPage, setCurrentPageId, goToParentPage } =
    useContextCommandPanelData(context);

  const thisPanelId = `${contextCommandPanelId}_${context.contextType}_${triggerType}`;

  const open = panelId === thisPanelId;
  const setOpen = (open: boolean) => {
    if (open) {
      setPanelId(thisPanelId);
    } else {
      setPanelId(null);
    }
  };

  useHotkey(
    "Mod+K",
    () => {
      setPanelId(thisPanelId);
    },
    {
      enabled:
        triggerType === "layout" &&
        (context.contextType === "team" || context.contextType === "project"),
      conflictBehavior: "allow",
    },
  );

  // Opened by keyboard shortcut there is no trigger to animate from
  const dialogContentVariantOptions: Parameters<
    typeof CommandPanelTrigger
  >["0"]["dialogContentVariantOptions"] = useMemo(
    () => ({ animate: triggerType === "layout" ? false : "default" }),
    [triggerType],
  );

  return (
    <ContextCommandPanelItemsProvider
      teamId={context.teamId}
      projectId={context.projectId || ""}
      page={currentPage}
      context={context}
      triggerType={triggerType}
    >
      <CommandPanelItemsProvider useCommandPanelItems={useContextCommandPanelItems}>
        <CommandPanelTrigger
          currentPage={currentPage}
          title={title}
          description={description}
          goToParentPage={goToParentPage}
          setCurrentPageId={setCurrentPageId}
          rootPage={rootPage}
          dialogContentVariantOptions={dialogContentVariantOptions}
          open={open}
          setOpen={setOpen}
        >
          {children}
        </CommandPanelTrigger>
      </CommandPanelItemsProvider>
    </ContextCommandPanelItemsProvider>
  );
}
