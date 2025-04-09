import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  CornerDownRightIcon,
  KeyRoundIcon,
  SettingsIcon,
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

  const navigateToSettings = useCallback(
    async ({
      pathname,
      context,
      isPendingId,
    }: {
      pathname: string;
      context: TContextCommandPanelContext;
      isPendingId?: string | null;
    }) => {
      const key = `go-tos_${context.contextType}_/settings${pathname}`;
      if (isPendingId === key) return;
      setIsPendingId(key);
      const res = await ResultAsync.fromPromise(
        asyncPush(getSettingsPageHref({ context, pathname, environmentId })),
        () => new Error("Failed to navigate to settings"),
      );
      if (res.isErr()) {
        toast.error("Failed to navigate", {
          description: res.error.message,
          duration: 3000,
        });
      }
      setIsPendingId(null);
      closePanel();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [environmentId],
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
      id: `go-to_${context.contextType}`,
      title: "Go to",
      keywords: ["navigate", "jump"],
      Icon: CornerDownRightIcon,
      subpage: {
        id: `go-tos_${context.contextType}`,
        title: "Go to",
        inputPlaceholder: "Go to...",
        parentPageId: contextCommandPanelRootPage,
        items: [
          {
            id: `go-tos_${context.contextType}_/settings`,
            title: settingsTitle,
            onSelect: (props) => {
              navigateToSettings({ context, pathname: "", isPendingId: props?.isPendingId });
            },
            Icon: SettingsIcon,
            keywords: ["settings", "general", "change", "tweak", "adjust", ...goToKeywords],
          },
          {
            id: `go-tos_${context.contextType}_/settings/shared-variables`,
            title: "Shared Variables",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: (props) => {
              navigateToSettings({
                context,
                pathname: "/shared-variables",
                isPendingId: props?.isPendingId,
              });
            },
            Icon: KeyRoundIcon,
            keywords: ["environment variables", "secrets", "keys", "values", ...goToKeywords],
          },
          {
            id: `go-tos_${context.contextType}_/settings/members`,
            title: "Members",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: (props) => {
              navigateToSettings({
                context,
                pathname: "/members",
                isPendingId: props?.isPendingId,
              });
            },
            Icon: UsersIcon,
            keywords: ["person", "people", "group", ...goToKeywords],
          },
          {
            id: `go-tos_${context.contextType}_/settings/webhooks`,
            title: "Webhooks",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: (props) => {
              navigateToSettings({
                context,
                pathname: "/webhooks",
                isPendingId: props?.isPendingId,
              });
            },
            Icon: WebhookIcon,
            keywords: ["hook", "integration", "alert", "connection", ...goToKeywords],
          },
          {
            id: `go-tos_${context.contextType}_/settings/danger-zone`,
            title: "Danger Zone",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: (props) => {
              navigateToSettings({
                context,
                pathname: "/danger-zone",
                isPendingId: props?.isPendingId,
              });
            },
            Icon: TriangleAlertIcon,
            keywords: ["delete", "danger", ...goToKeywords],
          },
        ],
      },
    };
  }, [navigateToSettings, context, settingsTitle, goToKeywords]);

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
