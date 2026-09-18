import useNavigateFromCommandPanel from "@/components/command-panel/context-command-panel/use-navigate-from-command-panel";
import { TCommandPanelItem } from "@/components/command-panel/types";
import { useRouter } from "@tanstack/react-router";
import {
  ChartColumnIcon,
  CircleArrowUpIcon,
  Grid2x2CheckIcon,
  HouseIcon,
  KeySquareIcon,
  MonitorIcon,
  SettingsIcon,
} from "lucide-react";
import { useMemo } from "react";

// Destinations every context lists, no matter which part of the app it belongs to.

const subpageId = "go-to_subpage";
const goToKeywords = ["go to", "navigate to", "jump to"];

const systemPages = [
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

const accountPages = [
  {
    to: "/account/settings",
    title: "Settings",
    Icon: SettingsIcon,
    keywords: ["account", "profile", "email", "password", "general"],
  },
  {
    to: "/account/settings/api-keys",
    title: "API Keys",
    Icon: KeySquareIcon,
    keywords: ["account", "api key", "token", "access", "cli", "automation"],
  },
  {
    to: "/account/settings/connected-apps",
    title: "Connected Apps",
    Icon: Grid2x2CheckIcon,
    keywords: [
      "account",
      "connected app",
      "connection",
      "connector",
      "mcp",
      "oauth",
      "integration",
      "claude",
      "chatgpt",
      "ai",
      "agent",
      "access",
      "revoke",
    ],
  },
] as const;

export function useAccountPageItems() {
  const router = useRouter();
  const navigateTo = useNavigateFromCommandPanel();

  const items: TCommandPanelItem[] = useMemo(() => {
    return accountPages.map((page) => {
      const id = `${subpageId}_${page.to}`;
      return {
        id,
        title: page.title,
        titleSuffix: " | Account",
        Icon: page.Icon,
        keywords: [...page.keywords, ...goToKeywords],
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

export function useHomePageItem() {
  const router = useRouter();
  const navigateTo = useNavigateFromCommandPanel();

  const item: TCommandPanelItem = useMemo(() => {
    const id = `${subpageId}_home`;
    return {
      id,
      title: "Home",
      Icon: HouseIcon,
      keywords: ["home", "projects", "teams", "dashboard", ...goToKeywords],
      onHighlight: () => {
        void router.preloadRoute({ to: "/" });
      },
      onSelect: () => {
        navigateTo({
          run: () => router.navigate({ to: "/" }),
          isPendingId: id,
          error: "Failed to navigate to home",
        });
      },
    };
  }, [navigateTo, router]);

  return item;
}

export function useSystemPageItems() {
  const router = useRouter();
  const navigateTo = useNavigateFromCommandPanel();

  const items: TCommandPanelItem[] = useMemo(() => {
    return systemPages.map((page) => {
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
