import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import useNavigateFromCommandPanel from "@/components/command-panel/context-command-panel/use-navigate-from-command-panel";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import { serverPanelServerNameKey } from "@/components/system/servers/panel/constants";
import { serversListQuery } from "@/lib/queries/servers";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  ChartColumnIcon,
  CircleArrowUpIcon,
  CornerDownRightIcon,
  HouseIcon,
  MonitorIcon,
  SettingsIcon,
} from "lucide-react";
import { useMemo } from "react";

type TProps = {
  context: TContextCommandPanelContext;
};

const pages = [
  {
    to: "/system",
    title: "Servers",
    Icon: MonitorIcon,
    keywords: ["servers", "nodes", "machines", "home page"],
  },
  {
    to: "/system/metrics",
    title: "Metrics",
    Icon: ChartColumnIcon,
    keywords: ["metrics", "usage", "cpu", "memory", "disk", "network"],
  },
  {
    to: "/system/update",
    title: "Updates",
    Icon: CircleArrowUpIcon,
    keywords: ["update", "upgrade", "version", "release"],
  },
  {
    to: "/system/settings",
    title: "Settings",
    Icon: SettingsIcon,
    keywords: ["settings", "general", "change", "tweak", "adjust"],
  },
] as const;

const subpageId = "go-to_subpage";
const goToKeywords = ["go to", "navigate to", "jump to"];

// Shared with the team and project contexts, which list the system pages for admins.
export function useSystemPageItems() {
  const router = useRouter();
  const navigateTo = useNavigateFromCommandPanel();

  const items: TCommandPanelItem[] = useMemo(() => {
    return pages.map((page) => {
      const id = `${subpageId}_${page.to}`;
      return {
        id,
        title: page.title,
        titleSuffix: " | System",
        Icon: page.Icon,
        keywords: ["system", ...page.keywords, ...goToKeywords],
        onHighlight: () => {
          void router.preloadRoute({ to: page.to });
        },
        onSelect: () => {
          navigateTo({
            run: () => router.navigate({ to: page.to }),
            isPendingId: id,
            error: `Failed to navigate to ${page.title}`,
          });
        },
      };
    });
  }, [navigateTo, router]);

  return items;
}

export default function useSystemGoToItem({ context }: TProps) {
  const mainPageId = "go-to";
  const router = useRouter();

  const navigateTo = useNavigateFromCommandPanel();
  const isSystemContext = context.contextType === "system";

  const { data: serversData } = useQuery({
    ...serversListQuery(),
    enabled: isSystemContext,
  });

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
        items: [
          {
            id: `${subpageId}_home`,
            title: "Home",
            Icon: HouseIcon,
            keywords: ["home", "projects", "teams", "dashboard", "exit system", ...goToKeywords],
            onHighlight: () => {
              void router.preloadRoute({ to: "/" });
            },
            onSelect: () => {
              navigateTo({
                run: () => router.navigate({ to: "/" }),
                isPendingId: `${subpageId}_home`,
                error: "Failed to navigate to home",
              });
            },
          },
          ...pageItems,
          ...serverItems,
        ],
      },
    };
  }, [isSystemContext, pageItems, serverItems, navigateTo, router]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
