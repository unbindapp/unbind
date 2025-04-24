import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  BoxIcon,
  ChartColumnIcon,
  CornerDownRightIcon,
  CpuIcon,
  FolderIcon,
  KeyIcon,
  SettingsIcon,
  TextSearchIcon,
  TriangleAlertIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  context: TContextCommandPanelContext;
};

export default function useNavigateItem({ context }: TProps) {
  const { asyncPush } = useAsyncPush();
  const router = useRouter();

  const { environmentId } = useIdsFromPathname();
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const navigateTo = useCallback(
    async ({ url, isPendingId, error }: { url: string; isPendingId: string; error: string }) => {
      setIsPendingId(isPendingId);
      const res = await ResultAsync.fromPromise(asyncPush(url), () => new Error(error));
      if (res.isErr()) {
        toast.error("Failed to navigate", {
          description: res.error.message,
          duration: 3000,
        });
        setIsPendingId(null);
        return;
      }
      setIsPendingId(null);
      closePanel();
    },
    [asyncPush, closePanel, setIsPendingId],
  );

  const navigateToSettings = useCallback(
    async ({ pathname, isPendingId }: { pathname: string; isPendingId: string }) => {
      await navigateTo({
        url: getSettingsPageHref({ pathname, context, environmentId }),
        isPendingId,
        error: "Failed to navigate to settings",
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigateTo, environmentId],
  );

  const goToKeywords = useMemo(() => ["go to", "navigate to", "jump to"], []);

  const settingsTitle = useMemo(() => {
    return context.contextType === "project" || context.contextType === "new-service"
      ? "Project Settings"
      : "Team Settings";
  }, [context]);

  const item: TCommandPanelItem | null = useMemo(() => {
    if (context.contextType !== "team" && context.contextType !== "project") {
      return null;
    }
    return {
      id: `go-to`,
      title: "Go to",
      keywords: ["navigate", "jump"],
      Icon: CornerDownRightIcon,
      subpage: {
        id: `go-tos`,
        title: "Go to",
        inputPlaceholder: "Go to...",
        parentPageId: contextCommandPanelRootPage,
        items: [
          ...(context.contextType === "project"
            ? ([
                {
                  id: `go-tos_services`,
                  title: "Services",
                  titleSuffix: ` | Project`,
                  Icon: CpuIcon,
                  onSelect: async () => {
                    navigateTo({
                      url: `/${context.teamId}/project/${context.projectId}?environment=${environmentId}`,
                      isPendingId: `go-tos_services`,
                      error: "Failed to navigate to services",
                    });
                  },
                  onHighlight: () => {
                    router.prefetch(
                      `/${context.teamId}/project/${context.projectId}?environment=${environmentId}`,
                    );
                  },
                  keywords: ["project", "home page", ...goToKeywords],
                },
                {
                  id: `go-tos_logs`,
                  title: "Logs",
                  titleSuffix: ` | Project`,
                  Icon: TextSearchIcon,
                  onSelect: async () => {
                    navigateTo({
                      url: `/${context.teamId}/project/${context.projectId}/logs?environment=${environmentId}`,
                      isPendingId: `go-tos_logs`,
                      error: "Failed to navigate to logs",
                    });
                  },
                  onHighlight: () => {
                    router.prefetch(
                      `/${context.teamId}/project/${context.projectId}/logs?environment=${environmentId}`,
                    );
                  },
                  keywords: ["logs", "errors", "warnings", "status", "project", ...goToKeywords],
                },
                {
                  id: `go-tos_metrics`,
                  title: "Metrics",
                  titleSuffix: ` | Project`,
                  Icon: ChartColumnIcon,
                  onSelect: async () => {
                    navigateTo({
                      url: `/${context.teamId}/project/${context.projectId}/metrics?environment=${environmentId}`,
                      isPendingId: `go-tos_metrics`,
                      error: "Failed to navigate to metrics",
                    });
                  },
                  onHighlight: () => {
                    router.prefetch(
                      `/${context.teamId}/project/${context.projectId}/metrics?environment=${environmentId}`,
                    );
                  },
                  keywords: ["metrics", "usage", "system", "project", ...goToKeywords],
                },
              ] as TCommandPanelItem[])
            : context.contextType === "team"
              ? [
                  {
                    id: `go-tos_projects`,
                    title: "Projects",
                    titleSuffix: ` | Team`,
                    Icon: FolderIcon,
                    onSelect: async () => {
                      navigateTo({
                        url: `/${context.teamId}`,
                        isPendingId: `go-tos_projects`,
                        error: "Failed to navigate to projects",
                      });
                    },
                    onHighlight: () => {
                      router.prefetch(`/${context.teamId}`);
                    },
                    keywords: ["projects", "home page", "team", ...goToKeywords],
                  },
                ]
              : []),
          {
            id: `go-tos_/settings`,
            title: context.contextType === "project" ? "Settings" : "Settings",
            titleSuffix: ` | ${context.contextType === "project" ? "Project" : "Team"}`,
            onSelect: () => {
              navigateToSettings({ pathname: "", isPendingId: `go-tos_/settings` });
            },
            onHighlight: () => {
              router.prefetch(getSettingsPageHref({ pathname: "", context, environmentId }));
            },
            Icon: SettingsIcon,
            keywords: [
              "settings",
              "general",
              "change",
              "tweak",
              "adjust",
              ...(context.contextType === "project"
                ? ["project"]
                : context.contextType === "team"
                  ? ["team"]
                  : []),
              ...goToKeywords,
            ],
          },
          ...(context.contextType === "project"
            ? [
                {
                  id: `go-tos_/settings/environments`,
                  title: "Environments",
                  titleSuffix: ` | ${settingsTitle}`,
                  onSelect: () => {
                    navigateToSettings({
                      pathname: "/environments",
                      isPendingId: `go-tos_/settings/environments`,
                    });
                  },
                  onHighlight: () => {
                    router.prefetch(
                      getSettingsPageHref({
                        pathname: "/environments",
                        context,
                        environmentId,
                      }),
                    );
                  },
                  Icon: BoxIcon,
                  keywords: [
                    "environments",
                    "production",
                    "staging",
                    "development",
                    ...goToKeywords,
                  ],
                },
              ]
            : []),
          {
            id: `go-tos_/settings/shared-variables`,
            title: "Shared Variables",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: () => {
              navigateToSettings({
                pathname: "/shared-variables",
                isPendingId: `go-tos_/settings/shared-variables`,
              });
            },
            onHighlight: () => {
              router.prefetch(
                getSettingsPageHref({ pathname: "/shared-variables", context, environmentId }),
              );
            },
            Icon: KeyIcon,
            keywords: ["environment variables", "secrets", "keys", "values", ...goToKeywords],
          },
          {
            id: `go-tos_/settings/members`,
            title: "Members",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: () => {
              navigateToSettings({
                pathname: "/members",
                isPendingId: `go-tos_/settings/members`,
              });
            },
            onHighlight: () => {
              router.prefetch(
                getSettingsPageHref({ pathname: "/members", context, environmentId }),
              );
            },
            Icon: UsersIcon,
            keywords: ["person", "people", "group", ...goToKeywords],
          },
          {
            id: `go-tos_/settings/webhooks`,
            title: "Webhooks",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: () => {
              navigateToSettings({
                pathname: "/webhooks",
                isPendingId: `go-tos_/settings/webhooks`,
              });
            },
            onHighlight: () => {
              router.prefetch(
                getSettingsPageHref({ pathname: "/webhooks", context, environmentId }),
              );
            },
            Icon: WebhookIcon,
            keywords: [
              "notification",
              "discord",
              "slack",
              "hook",
              "integration",
              "alert",
              "connection",
              ...goToKeywords,
            ],
          },
          {
            id: `go-tos_/settings/danger-zone`,
            title: "Danger Zone",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: () => {
              navigateToSettings({
                pathname: "/danger-zone",
                isPendingId: `go-tos_/settings/danger-zone`,
              });
            },
            onHighlight: () => {
              router.prefetch(
                getSettingsPageHref({ pathname: "/danger-zone", context, environmentId }),
              );
            },
            Icon: TriangleAlertIcon,
            keywords: ["delete", "danger", ...goToKeywords],
          },
        ],
      },
    };
  }, [navigateToSettings, context, settingsTitle, goToKeywords, environmentId, navigateTo, router]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}

function getSettingsPageHref({
  pathname,
  context,
  environmentId,
}: {
  pathname: string;
  context: TContextCommandPanelContext;
  environmentId?: string | null;
}) {
  return context.contextType === "project" || context.contextType === "new-service"
    ? `/${context.teamId}/project/${context.projectId}/settings${pathname}?environment=${environmentId}`
    : `/${context.teamId}/settings${pathname}`;
}
