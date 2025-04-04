import { useCommandPanelState } from "@/components/command-panel/command-panel-state-provider";
import { commandPanelContextAwareRootPage } from "@/components/command-panel/constants";
import {
  TCommandPanelItem,
  TContextAwareCommandPanelContext,
} from "@/components/command-panel/types";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  BellIcon,
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
  context: TContextAwareCommandPanelContext;
};

export default function useNavigateItem({ context }: TProps) {
  const { environmentId } = useIdsFromPathname();
  const { asyncPush } = useAsyncPush();
  const { setIsPendingId } = useCommandPanelState();

  const navigateToSettings = useCallback(
    async ({
      pathname,
      context,
      isPendingId,
    }: {
      pathname: string;
      context: TContextAwareCommandPanelContext;
      isPendingId?: string | null;
    }) => {
      const key = `/settings${pathname}`;
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [environmentId],
  );

  const goToKeywords = useMemo(() => ["go to", "navigate to", "jump to"], []);

  const settingsTitle = useMemo(() => {
    return context.contextType === "project" ? "Project Settings" : "Team Settings";
  }, [context]);

  const item: TCommandPanelItem = useMemo(() => {
    return {
      title: "Go to",
      keywords: ["navigate", "jump"],
      Icon: CornerDownRightIcon,
      subpage: {
        title: "Go to",
        id: "go_to",
        inputPlaceholder: "Go to...",
        parentPageId: commandPanelContextAwareRootPage,
        items: [
          {
            id: `/settings`,
            title: settingsTitle,
            onSelect: (props) => {
              navigateToSettings({ context, pathname: "", isPendingId: props?.isPendingId });
            },
            Icon: SettingsIcon,
            keywords: ["settings", "general", "change", "tweak", "adjust", ...goToKeywords],
          },
          {
            id: `/settings/shared-variables`,
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
            id: `/settings/members`,
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
            id: `/settings/notifications`,
            title: "Notifications",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: (props) => {
              navigateToSettings({
                context,
                pathname: "/notifications",
                isPendingId: props?.isPendingId,
              });
            },
            Icon: BellIcon,
            keywords: ["notify", "alert", ...goToKeywords],
          },
          {
            id: `/settings/webhooks`,
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
            id: `/settings/danger-zone`,
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
  context: TContextAwareCommandPanelContext;
  environmentId?: string | null;
}) {
  return context.contextType === "project"
    ? `/${context.teamId}/project/${context.projectId}/settings${pathname}?environment=${environmentId}`
    : `/${context.teamId}/settings${pathname}`;
}
