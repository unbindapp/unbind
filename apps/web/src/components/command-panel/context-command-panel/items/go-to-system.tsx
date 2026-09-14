import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import {
  useHomePageItem,
  useSystemPageItems,
} from "@/components/command-panel/context-command-panel/items/go-to-shared";
import useNavigateFromCommandPanel from "@/components/command-panel/context-command-panel/use-navigate-from-command-panel";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import { serverPanelServerNameKey } from "@/components/system/servers/panel/constants";
import { serversListQuery } from "@/lib/queries/servers";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { CornerDownRightIcon, MonitorIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  context: TContextCommandPanelContext;
};

const subpageId = "go-to_subpage";
const goToKeywords = ["go to", "navigate to", "jump to"];

export default function useSystemGoToItem({ context }: TProps) {
  const mainPageId = "go-to";
  const router = useRouter();

  const navigateTo = useNavigateFromCommandPanel();
  const isSystemContext = context.contextType === "system";

  const { data: serversData } = useQuery({
    ...serversListQuery(),
    enabled: isSystemContext,
  });

  const homeItem = useHomePageItem();
  const pageItems = useSystemPageItems();

  // The server panel only renders on the servers page, so selecting a server
  // navigates there and opens it via the search param.
  const serverItems: TCommandPanelItem[] = useMemo(() => {
    if (!isSystemContext || !serversData) return [];
    return serversData.data.map((server) => {
      const id = `${subpageId}_server_${server.name}`;
      const linkProps = {
        to: "/system",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          [serverPanelServerNameKey]: server.name,
        }),
        replace: true,
        resetScroll: false,
      } as const;
      return {
        id,
        title: server.name,
        titleSuffix: " (Server)",
        hideFromParentSearch: true,
        Icon: MonitorIcon,
        keywords: ["server", "node", "machine", ...server.roles, ...goToKeywords],
        onHighlight: () => {
          void router.preloadRoute(linkProps);
        },
        onSelect: () => {
          navigateTo({
            run: () => router.navigate(linkProps),
            isPendingId: id,
            error: `Failed to navigate to ${server.name}`,
          });
        },
      };
    });
  }, [isSystemContext, serversData, navigateTo, router]);

  const item: TCommandPanelItem | null = useMemo(() => {
    if (!isSystemContext) return null;
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
        items: [homeItem, ...pageItems, ...serverItems],
      },
    };
  }, [isSystemContext, homeItem, pageItems, serverItems]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
