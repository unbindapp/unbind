import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";

export function getAllItemsFromCommandPanelPage(page: TCommandPanelPage): TCommandPanelItem[] {
  if (!page.items) return [];
  return page.items.flatMap((item) => {
    if (item.subpage) {
      return [...getAllItemsFromCommandPanelPage(item.subpage)];
    }
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
    if (!page.items) return null;
    for (const item of page.items) {
      if (item.subpage) {
        const found = findCommandPanelPage({ id, page: item.subpage });
        if (found) return found;
      }
    }
  }
  return null;
}
