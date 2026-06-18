import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  ArchiveIcon,
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
import { useRouter } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  context: TContextCommandPanelContext;
};

export default function useGoToItem({ context }: TProps) {
  const mainPageId = "go-to";
  const subpageId = "go-to_subpage";
  const router = useRouter();

  const { environmentId } = useIdsFromPathname();
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  // Wraps a typesafe `router.navigate(...)` call with the command-panel
  // pending state, error toast, and panel close behavior.
  const navigateTo = useCallback(
    async ({
      run,
      isPendingId,
      error,
    }: {
      run: () => Promise<unknown>;
      isPendingId: string;
      error: string;
    }) => {
      setIsPendingId(isPendingId);
      const res = await ResultAsync.fromPromise(run(), () => new Error(error));
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
    [closePanel, setIsPendingId],
  );

  // Typesafe navigation options for a settings page. Project and team settings
  // live under different route trees, so branch on the context type.
  const settingsNav = useCallback(
    (suffix: "" | "/environments" | "/storage" | "/variables" | "/members" | "/webhooks" | "/danger-zone") => {
      if (context.contextType === "project" || context.contextType === "new-service") {
        const params = { team_id: context.teamId, project_id: context.projectId };
        const search = { environment: environmentId ?? undefined };
        switch (suffix) {
          case "/environments":
            return { to: "/$team_id/project/$project_id/settings/environments", params, search } as const;
          case "/variables":
            return { to: "/$team_id/project/$project_id/settings/variables", params, search } as const;
          case "/members":
            return { to: "/$team_id/project/$project_id/settings/members", params, search } as const;
          case "/webhooks":
            return { to: "/$team_id/project/$project_id/settings/webhooks", params, search } as const;
          case "/danger-zone":
            return { to: "/$team_id/project/$project_id/settings/danger-zone", params, search } as const;
          default:
            return { to: "/$team_id/project/$project_id/settings", params, search } as const;
        }
      }
      if (context.contextType === "team") {
        const params = { team_id: context.teamId };
        switch (suffix) {
          case "/storage":
            return { to: "/$team_id/settings/storage", params } as const;
          case "/variables":
            return { to: "/$team_id/settings/variables", params } as const;
          case "/members":
            return { to: "/$team_id/settings/members", params } as const;
          case "/webhooks":
            return { to: "/$team_id/settings/webhooks", params } as const;
          case "/danger-zone":
            return { to: "/$team_id/settings/danger-zone", params } as const;
          default:
            return { to: "/$team_id/settings", params } as const;
        }
      }
      return null;
    },
    [context, environmentId],
  );

  const navigateToSettings = useCallback(
    async ({
      suffix,
      isPendingId,
    }: {
      suffix: Parameters<typeof settingsNav>[0];
      isPendingId: string;
    }) => {
      const nav = settingsNav(suffix);
      if (!nav) return;
      await navigateTo({
        run: () => router.navigate(nav),
        isPendingId,
        error: "Failed to navigate to settings",
      });
    },
    [navigateTo, settingsNav, router],
  );

  const prefetchSettings = useCallback(
    (suffix: Parameters<typeof settingsNav>[0]) => {
      const nav = settingsNav(suffix);
      if (nav) void router.preloadRoute(nav);
    },
    [settingsNav, router],
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
          ...(context.contextType === "project"
            ? ([
                {
                  id: `${subpageId}_services`,
                  title: "Services",
                  titleSuffix: ` | Project`,
                  Icon: CpuIcon,
                  onSelect: async () => {
                    navigateTo({
                      run: () =>
                        router.navigate({
                          to: "/$team_id/project/$project_id",
                          params: { team_id: context.teamId, project_id: context.projectId },
                          search: { environment: environmentId ?? undefined },
                        }),
                      isPendingId: `${subpageId}_services`,
                      error: "Failed to navigate to services",
                    });
                  },
                  onHighlight: () => {
                    void router.preloadRoute({
                      to: "/$team_id/project/$project_id",
                      params: { team_id: context.teamId, project_id: context.projectId },
                      search: { environment: environmentId ?? undefined },
                    });
                  },
                  keywords: ["project", "home page", ...goToKeywords],
                },
                {
                  id: `${subpageId}_logs`,
                  title: "Logs",
                  titleSuffix: ` | Project`,
                  Icon: TextSearchIcon,
                  onSelect: async () => {
                    navigateTo({
                      run: () =>
                        router.navigate({
                          to: "/$team_id/project/$project_id/logs",
                          params: { team_id: context.teamId, project_id: context.projectId },
                          search: { environment: environmentId ?? undefined },
                        }),
                      isPendingId: `${subpageId}_logs`,
                      error: "Failed to navigate to logs",
                    });
                  },
                  onHighlight: () => {
                    void router.preloadRoute({
                      to: "/$team_id/project/$project_id/logs",
                      params: { team_id: context.teamId, project_id: context.projectId },
                      search: { environment: environmentId ?? undefined },
                    });
                  },
                  keywords: ["logs", "errors", "warnings", "status", "project", ...goToKeywords],
                },
                {
                  id: `${subpageId}_metrics`,
                  title: "Metrics",
                  titleSuffix: ` | Project`,
                  Icon: ChartColumnIcon,
                  onSelect: async () => {
                    navigateTo({
                      run: () =>
                        router.navigate({
                          to: "/$team_id/project/$project_id/metrics",
                          params: { team_id: context.teamId, project_id: context.projectId },
                          search: { environment: environmentId ?? undefined },
                        }),
                      isPendingId: `${subpageId}_metrics`,
                      error: "Failed to navigate to metrics",
                    });
                  },
                  onHighlight: () => {
                    void router.preloadRoute({
                      to: "/$team_id/project/$project_id/metrics",
                      params: { team_id: context.teamId, project_id: context.projectId },
                      search: { environment: environmentId ?? undefined },
                    });
                  },
                  keywords: ["metrics", "usage", "system", "project", ...goToKeywords],
                },
              ] as TCommandPanelItem[])
            : context.contextType === "team"
              ? [
                  {
                    id: `${subpageId}_projects`,
                    title: "Projects",
                    titleSuffix: ` | Team`,
                    Icon: FolderIcon,
                    onSelect: async () => {
                      navigateTo({
                        run: () =>
                          router.navigate({ to: "/$team_id", params: { team_id: context.teamId } }),
                        isPendingId: `${subpageId}_projects`,
                        error: "Failed to navigate to projects",
                      });
                    },
                    onHighlight: () => {
                      void router.preloadRoute({ to: "/$team_id", params: { team_id: context.teamId } });
                    },
                    keywords: ["projects", "home page", "team", ...goToKeywords],
                  },
                ]
              : []),
          {
            id: `${subpageId}_/settings`,
            title: context.contextType === "project" ? "Settings" : "Settings",
            titleSuffix: ` | ${context.contextType === "project" ? "Project" : "Team"}`,
            onSelect: () => {
              navigateToSettings({ suffix: "", isPendingId: `${subpageId}_/settings` });
            },
            onHighlight: () => {
              prefetchSettings("");
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
                  id: `${subpageId}_/settings/environments`,
                  title: "Environments",
                  titleSuffix: ` | ${settingsTitle}`,
                  onSelect: () => {
                    navigateToSettings({
                      suffix: "/environments",
                      isPendingId: `${subpageId}_/settings/environments`,
                    });
                  },
                  onHighlight: () => {
                    prefetchSettings("/environments");
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
          ...(context.contextType === "team"
            ? [
                {
                  id: `${subpageId}_/settings/storage`,
                  title: "Storage",
                  titleSuffix: ` | ${settingsTitle}`,
                  onSelect: () => {
                    navigateToSettings({
                      suffix: "/storage",
                      isPendingId: `${subpageId}_/settings/storage`,
                    });
                  },
                  onHighlight: () => {
                    prefetchSettings("/storage");
                  },
                  Icon: ArchiveIcon,
                  keywords: ["s3", "r2", "backup", "source", "storage", ...goToKeywords],
                },
              ]
            : []),
          {
            id: `${subpageId}_/settings/variables`,
            title:
              context.contextType === "team"
                ? "Team Variables"
                : context.contextType === "project"
                  ? "Project Variables"
                  : "Shared Variables",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: () => {
              navigateToSettings({
                suffix: "/variables",
                isPendingId: `${subpageId}_/settings/variables`,
              });
            },
            onHighlight: () => {
              prefetchSettings("/variables");
            },
            Icon: KeyIcon,
            keywords: [
              "environment variables",
              "shared variables",
              "secrets",
              "keys",
              "values",
              ...goToKeywords,
            ],
          },
          {
            id: `${subpageId}_/settings/members`,
            title: "Members",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: () => {
              navigateToSettings({
                suffix: "/members",
                isPendingId: `${subpageId}_/settings/members`,
              });
            },
            onHighlight: () => {
              prefetchSettings("/members");
            },
            Icon: UsersIcon,
            keywords: ["person", "people", "group", ...goToKeywords],
          },
          {
            id: `${subpageId}_/settings/webhooks`,
            title: "Webhooks",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: () => {
              navigateToSettings({
                suffix: "/webhooks",
                isPendingId: `${subpageId}_/settings/webhooks`,
              });
            },
            onHighlight: () => {
              prefetchSettings("/webhooks");
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
            id: `${subpageId}_/settings/danger-zone`,
            title: "Danger Zone",
            titleSuffix: ` | ${settingsTitle}`,
            onSelect: () => {
              navigateToSettings({
                suffix: "/danger-zone",
                isPendingId: `${subpageId}_/settings/danger-zone`,
              });
            },
            onHighlight: () => {
              prefetchSettings("/danger-zone");
            },
            Icon: TriangleAlertIcon,
            keywords: ["delete", "danger", ...goToKeywords],
          },
        ],
      },
    };
  }, [
    navigateToSettings,
    prefetchSettings,
    context,
    settingsTitle,
    goToKeywords,
    environmentId,
    navigateTo,
    router,
  ]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
