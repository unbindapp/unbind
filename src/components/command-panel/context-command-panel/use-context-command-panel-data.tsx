import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import useDatabaseItem from "@/components/command-panel/context-command-panel/items/database";
import { useDockerImageItemHook } from "@/components/command-panel/context-command-panel/items/docker-image";
import useGoToItem from "@/components/command-panel/context-command-panel/items/go-to";
import useNewProjectItem from "@/components/command-panel/context-command-panel/items/new-project";
import usePreferencesItem from "@/components/command-panel/context-command-panel/items/preferences";
import { useRepoItemHook } from "@/components/command-panel/context-command-panel/items/repo";
import useTemplateItem from "@/components/command-panel/context-command-panel/items/template";
import { findCommandPanelPage } from "@/components/command-panel/helpers";
import { TCommandPanelPage, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { defaultAnimationMs } from "@/lib/constants";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useContextCommandPanelData(context: TContextCommandPanelContext) {
  const { panelPageId, setPanelId, setPanelPageId } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });
  const timeout = useRef<NodeJS.Timeout | null>(null);

  const useRepoItem = useRepoItemHook({ context });
  const useDockerImageItem = useDockerImageItemHook({ context });

  const { item: repoItem } = useRepoItem({ context });
  const { item: dockerImageItem } = useDockerImageItem({ context });
  const { item: templateItem } = useTemplateItem({ context });
  const { item: goToItem } = useGoToItem({ context });
  const { item: databaseItem } = useDatabaseItem({ context });
  const { item: newProjectItem } = useNewProjectItem({ context });
  const { item: preferencesItem } = usePreferencesItem({ context });

  const onSelectPlaceholder = useCallback(() => {
    toast.success("Successful", {
      description: "This is fake.",
      duration: 3000,
      closeButton: false,
    });
    setPanelId(null);
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      setPanelPageId(null);
    }, defaultAnimationMs);
  }, [setPanelId, setPanelPageId]);

  const rootPage: TCommandPanelPage = useMemo(
    () => ({
      id: contextCommandPanelRootPage,
      title:
        context.contextType === "new-project"
          ? "New Project"
          : context.contextType === "new-service"
            ? "New service"
            : "Commands",
      parentPageId: null,
      inputPlaceholder: "Search commands...",
      items: [
        ...(context.contextType === "team" || context.contextType === "new-project"
          ? [newProjectItem]
          : []),
        ...(repoItem ? [repoItem] : []),
        databaseItem,
        templateItem,
        ...(dockerImageItem ? [dockerImageItem] : []),
        ...(preferencesItem ? [preferencesItem] : []),
        ...(goToItem ? [goToItem] : []),
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      onSelectPlaceholder,
      repoItem,
      dockerImageItem,
      databaseItem,
      templateItem,
      dockerImageItem,
      goToItem,
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
