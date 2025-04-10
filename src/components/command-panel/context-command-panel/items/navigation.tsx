import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  ChartColumnIcon,
  CornerDownRightIcon,
  CpuIcon,
  FolderIcon,
  KeyRoundIcon,
  SettingsIcon,
  TextSearchIcon,
  TriangleAlertIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  context: TContextCommandPanelContext;
};

export default function useNavigateItem({ context }: TProps) {
  const { environmentId } = useIdsFromPathname();
  const { asyncPush } = useAsyncPush();
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
            Icon: KeyRoundIcon,
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
            Icon: WebhookIcon,
            keywords: ["hook", "integration", "alert", "connection", ...goToKeywords],
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
            Icon: TriangleAlertIcon,
            keywords: ["delete", "danger", ...goToKeywords],
          },
        ],
      },
    };
  }, [navigateToSettings, context, settingsTitle, goToKeywords, environmentId, navigateTo]);

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
