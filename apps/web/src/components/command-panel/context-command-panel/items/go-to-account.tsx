import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import {
  useAccountPageItems,
  useHomePageItem,
  useSystemPageItems,
} from "@/components/command-panel/context-command-panel/items/go-to-shared";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import { isSystemAdmin, meQuery } from "@/lib/queries/me";
import { useQuery } from "@tanstack/react-query";
import { CornerDownRightIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  context: TContextCommandPanelContext;
};

const subpageId = "go-to_subpage";

export default function useAccountGoToItem({ context }: TProps) {
  const mainPageId = "go-to";
  const isAccountContext = context.contextType === "account";

  const { data: me } = useQuery(meQuery);
  const homeItem = useHomePageItem();
  const accountItems = useAccountPageItems();
  const systemPageItems = useSystemPageItems();

  const item: TCommandPanelItem | null = useMemo(() => {
    if (!isAccountContext) return null;
    return {
      id: mainPageId,
      title: "Go to",
      keywords: ["navigate", "jump"],
      Icon: CornerDownRightIcon,
      subpage: {
        id: subpageId,
        title: "Go to",
        inputPlaceholder: "Go to...",
        parentPageId: contextCommandPanelRootPage,
        items: [homeItem, ...accountItems, ...(isSystemAdmin(me) ? systemPageItems : [])],
      },
    };
  }, [isAccountContext, homeItem, accountItems, systemPageItems, me]);

  return useMemo(() => ({ item }), [item]);
}
