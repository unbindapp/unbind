import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";

export type TCommandPanelSearchGroup = {
  page: TCommandPanelPage;
  Icon: TCommandPanelItem["Icon"];
  items: TCommandPanelItem[];
};

export function getSearchGroupsFromCommandPanelPage(
  page: TCommandPanelPage,
): TCommandPanelSearchGroup[] {
  if (!page.items) return [];
  return page.items.flatMap((item) => {
    if (!item.subpage) return [];
    const items = getAllItemsFromCommandPanelPage(item.subpage);
    if (items.length === 0) return [];
    return { page: item.subpage, Icon: item.Icon, items };
  });
}

export function getAllItemsFromCommandPanelPage(page: TCommandPanelPage): TCommandPanelItem[] {
  if (!page.items) return [];
  return page.items.flatMap((item) => {
    if (item.subpage) {
      return getAllItemsFromCommandPanelPage(item.subpage);
    }
    if (item.hideFromParentSearch) return [];
    return item;
  });
}

export function findCommandPanelPage({
  id,
  page,
}: {
  id: string;
  page: TCommandPanelPage;
}): TCommandPanelPage | null {
  if (page.id === id) return page;
  if (page.items) {
    for (const item of page.items) {
      if (item.subpage) {
        const found = findCommandPanelPage({ id, page: item.subpage });
        if (found) return found;
      }
    }
  }
  if (page.itemsPinned) {
    for (const item of page.itemsPinned) {
      if (item.subpage) {
        const found = findCommandPanelPage({ id, page: item.subpage });
        if (found) return found;
      }
    }
  }
  return null;
}
