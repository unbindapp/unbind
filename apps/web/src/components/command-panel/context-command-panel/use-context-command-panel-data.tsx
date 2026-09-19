import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useDatabaseItemHook } from "@/components/command-panel/context-command-panel/items/database";
import { useDockerImageItemHook } from "@/components/command-panel/context-command-panel/items/docker-image";
import { useGitItemHook } from "@/components/command-panel/context-command-panel/items/git";
import useGoToItem from "@/components/command-panel/context-command-panel/items/go-to";
import useAccountGoToItem from "@/components/command-panel/context-command-panel/items/go-to-account";
import useSystemGoToItem from "@/components/command-panel/context-command-panel/items/go-to-system";
import useNewProjectItem from "@/components/command-panel/context-command-panel/items/new-project";
import usePreferencesItem from "@/components/command-panel/context-command-panel/items/preferences";
import { useTemplateItemHook } from "@/components/command-panel/context-command-panel/items/template";
import { useVolumeItemHook } from "@/components/command-panel/context-command-panel/items/volume";
import { findCommandPanelPage } from "@/components/command-panel/helpers";
import { TCommandPanelPage, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useCallback, useMemo } from "react";

export default function useContextCommandPanelData(context: TContextCommandPanelContext) {
  const { panelPageId, setPanelPageId } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const useGitItem = useGitItemHook({ context });
  const useDockerImageItem = useDockerImageItemHook({ context });
  const useDatabaseItem = useDatabaseItemHook({ context });
  const useTemplateItem = useTemplateItemHook({ context });
  const useVolumeItem = useVolumeItemHook({ context });

  const { item: gitItem } = useGitItem({ context });
  const { item: dockerImageItem } = useDockerImageItem();
  const { item: databaseItem } = useDatabaseItem();
  const { item: volumeItem } = useVolumeItem();

  const { item: templateItem } = useTemplateItem();
  const { item: goToItem } = useGoToItem({ context });
  const { item: systemGoToItem } = useSystemGoToItem({ context });
  const { item: accountGoToItem } = useAccountGoToItem({ context });
  const { item: newProjectItem } = useNewProjectItem({ context });
  const { item: preferencesItem } = usePreferencesItem({ context });

  const rootPage: TCommandPanelPage = useMemo(
    () => ({
      id: contextCommandPanelRootPage,
      title: context.contextType === "new-service" ? "Add Service" : "Commands",
      parentPageId: null,
      inputPlaceholder: "Search commands...",
      items: [
        ...(context.contextType === "team" && newProjectItem ? [newProjectItem] : []),
        ...(gitItem ? [gitItem] : []),
        ...(databaseItem ? [databaseItem] : []),
        ...(templateItem ? [templateItem] : []),
        ...(dockerImageItem ? [dockerImageItem] : []),
        ...(volumeItem ? [volumeItem] : []),
        ...(preferencesItem ? [preferencesItem] : []),
        ...(goToItem ? [goToItem] : []),
        ...(systemGoToItem ? [systemGoToItem] : []),
        ...(accountGoToItem ? [accountGoToItem] : []),
      ],
    }),
    [
      newProjectItem,
      gitItem,
      dockerImageItem,
      databaseItem,
      templateItem,
      volumeItem,
      goToItem,
      systemGoToItem,
      accountGoToItem,
      preferencesItem,
      context,
    ],
  );

  const setCurrentPageId = useCallback(
    (id: string) => {
      setPanelPageId(id);
    },
    [setPanelPageId],
  );

  const currentPage = panelPageId
    ? findCommandPanelPage({
        id: panelPageId,
        page: rootPage,
      }) || rootPage
    : rootPage;

  const allPageIds = useMemo(() => {
    const ids = new Set<string>();
    const addIds = (page: TCommandPanelPage) => {
      ids.add(page.id);
      if (!page.items) return;
      page.items.forEach((item) => {
        if (item.subpage) {
          addIds(item.subpage);
        }
      });
    };
    addIds(rootPage);
    return [...ids];
  }, [rootPage]);

  const goToParentPage = useCallback(
    (e?: KeyboardEvent) => {
      if (currentPage.id === contextCommandPanelRootPage) {
        return;
      }
      if (currentPage.parentPageId === null) return;
      const parentPage = findCommandPanelPage({
        id: currentPage.parentPageId,
        page: rootPage,
      });
      if (parentPage) {
        e?.preventDefault();
        setCurrentPageId(parentPage.id);
      } else {
        setCurrentPageId(rootPage.id);
      }
    },
    [currentPage, rootPage, setCurrentPageId],
  );

  return {
    rootPage,
    currentPage,
    setCurrentPageId,
    allPageIds,
    goToParentPage,
  };
}
