import {
  commandPanelContextAwareRootPage,
  commandPanelKey,
  commandPanelPageKey,
} from "@/components/command-panel/constants";
import { findCommandPanelPage } from "@/components/command-panel/helpers";
import {
  TCommandPanelItem,
  TCommandPanelPage,
  TContextAwareCommandPanelContext,
} from "@/components/command-panel/types";
import ServiceIcon from "@/components/icons/service";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { cn } from "@/components/ui/utils";
import { api } from "@/server/trpc/setup/client";
import {
  BellIcon,
  BlocksIcon,
  CornerDownRightIcon,
  DatabaseIcon,
  FolderPlusIcon,
  KeyRoundIcon,
  LoaderIcon,
  SettingsIcon,
  TriangleAlertIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { FC, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export default function useContextAwareCommandPanelData(context: TContextAwareCommandPanelContext) {
  const [, setPanelId] = useQueryState(commandPanelKey);
  const [panelPageId, setPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelContextAwareRootPage),
  );
  const { asyncPush, isPending: isAsyncPushPending } = useAsyncPush();
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const utils = api.useUtils();

  const { mutate: createProject, isPending: isCreateProjectPending } =
    api.projects.create.useMutation({
      onSuccess: async (res) => {
        const projectId = res.data?.id;
        const environments = res.data.environments;
        if (environments.length < 1) {
          throw new Error("No environment found");
        }
        const environmentId = environments[0].id;
        if (!projectId || !environmentId) {
          throw new Error("Project or environment ID not found");
        }
        await utils.projects.list.invalidate({ teamId: context.teamId });
        await asyncPush(`/${context.teamId}/project/${projectId}/environment/${environmentId}`);
      },
    });

  const onSelectPlaceholder = useCallback(() => {
    toast.success("Successful", {
      description: "This is fake.",
      duration: 3000,
      closeButton: false,
    });
    setPanelId(null);
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      setPanelPageId(null);
    }, 150);
  }, [setPanelId, setPanelPageId]);

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const PendingOrIcon = useCallback(
    ({
      id,
      Icon,
      className,
      isPending,
    }: {
      id: string;
      Icon: FC<{ className?: string }>;
      className?: string;
      isPending: boolean;
    }) => {
      if (isPending && lastSelectedId === id) {
        return <LoaderIcon className={cn("animate-spin", className)} />;
      }
      return <Icon className={className} />;
    },
    [lastSelectedId],
  );

  const navigateToSettings = useCallback(
    ({ pathname, context }: { pathname: string; context: TContextAwareCommandPanelContext }) => {
      setLastSelectedId(`/settings${pathname}`);
      asyncPush(getSettingsPageHref({ context, pathname }));
    },
    [asyncPush],
  );

  const goToKeywords = useMemo(() => ["go to", "navigate to", "jump to"], []);

  const settingsTitle = useMemo(() => {
    return context.contextType === "project" ? "Project Settings" : "Team Settings";
  }, [context]);

  const rootPage: TCommandPanelPage = useMemo(
    () => ({
      id: commandPanelContextAwareRootPage,
      title: "Commands",
      parentPageId: null,
      inputPlaceholder: "Search commands...",
      items: [
        ...(context.contextType === "team"
          ? ([
              {
                title: "New Project",
                keywords: ["New Project", "Create project...", "Creating project..."],
                onSelect: () => {
                  if (isCreateProjectPending) return;
                  setLastSelectedId("new-project");
                  createProject({ teamId: context.teamId });
                },
                Icon: ({ className }) => (
                  <PendingOrIcon
                    isPending={isCreateProjectPending || isAsyncPushPending}
                    id="new-project"
                    Icon={FolderPlusIcon}
                    className={className}
                  />
                ),
              },
            ] as TCommandPanelItem[])
          : []),
        {
          title: "GitHub Repo",
          keywords: ["deploy from github", "deploy from gitlab", "deploy from bitbucket"],
          Icon: ({ className }) => <ServiceIcon variant="github" className={className} />,
          subpage: {
            id: "github_repos",
            title: "GitHub Repos",
            parentPageId: commandPanelContextAwareRootPage,
            inputPlaceholder: "Deploy from GitHub...",
            getItems: async () => {
              const res = await utils.main.getRepos.fetch({ teamId: context.teamId });
              const items: TCommandPanelItem[] = res.repos.map((r) => ({
                title: `${r.full_name}`,
                keywords: [],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }: { className?: string }) => (
                  <ServiceIcon color="brand" variant="github" className={className} />
                ),
              }));
              return items;
            },
          },
        },
        {
          title: "Database",
          keywords: ["persistent", "persistence"],
          Icon: DatabaseIcon,
          subpage: {
            id: "databases",
            title: "Databases",
            parentPageId: commandPanelContextAwareRootPage,
            inputPlaceholder: "Deploy a database...",
            items: [
              {
                title: "PostgreSQL",
                keywords: ["database", "sql", "mysql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="postgresql" className={className} />
                ),
              },
              {
                title: "Redis",
                keywords: ["database", "cache", "key value"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="redis" className={className} />
                ),
              },
              {
                title: "MongoDB",
                keywords: ["database", "object"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="mongodb" className={className} />
                ),
              },
              {
                title: "MySQL",
                keywords: ["database", "sql", "postgresql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="mysql" className={className} />
                ),
              },
              {
                title: "ClickHouse",
                keywords: ["database", "analytics", "sql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="clickhouse" className={className} />
                ),
              },
            ],
          },
        },
        {
          title: "Template",
          keywords: ["blueprint", "stack", "group"],
          Icon: BlocksIcon,
          subpage: {
            id: "templates",
            title: "Templates",
            parentPageId: commandPanelContextAwareRootPage,
            inputPlaceholder: "Deploy a template...",
            items: [
              {
                title: "Strapi",
                keywords: ["cms", "content"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="strapi" className={className} />
                ),
              },
              {
                title: "Umami",
                keywords: ["analytics", "privacy", "tracking"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="umami" className={className} />
                ),
              },
              {
                title: "Meilisearch",
                keywords: ["full text search", "elasticsearch", "ram"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="meilisearch" className={className} />
                ),
              },
              {
                title: "MinIO",
                keywords: ["s3", "file storage"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="minio" className={className} />
                ),
              },
              {
                title: "PocketBase",
                keywords: [
                  "paas",
                  "backend",
                  "authentication",
                  "realtime database",
                  "file storage",
                ],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="pocketbase" className={className} />
                ),
              },
              {
                title: "N8N",
                keywords: ["workflow automation", "ai", "devops", "itops"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="n8n" className={className} />
                ),
              },
              {
                title: "Ghost",
                keywords: ["blogging"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon color="brand" variant="ghost" className={className} />
                ),
              },
            ],
          },
        },
        {
          title: "Docker Image",
          keywords: ["deploy"],
          onSelect: () => onSelectPlaceholder(),
          Icon: ({ className }) => <ServiceIcon variant="docker" className={className} />,
        },
        {
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
                title: settingsTitle,
                onSelect: () => navigateToSettings({ context, pathname: "" }),
                Icon: ({ className }) => (
                  <PendingOrIcon
                    isPending={isAsyncPushPending}
                    id="/settings"
                    Icon={SettingsIcon}
                    className={className}
                  />
                ),
                keywords: ["settings", "general", "change", "tweak", "adjust", ...goToKeywords],
              },
              {
                title: "Shared Variables",
                titleSuffix: ` | ${settingsTitle}`,
                onSelect: () => {
                  navigateToSettings({ context, pathname: "/shared-variables" });
                },
                Icon: ({ className }) => (
                  <PendingOrIcon
                    isPending={isAsyncPushPending}
                    id="/settings/shared-variables"
                    Icon={KeyRoundIcon}
                    className={className}
                  />
                ),
                keywords: ["secrets", "keys", "values", ...goToKeywords],
              },
              {
                title: "Members",
                titleSuffix: ` | ${settingsTitle}`,
                onSelect: () => {
                  navigateToSettings({ context, pathname: "/members" });
                },
                Icon: ({ className }) => (
                  <PendingOrIcon
                    isPending={isAsyncPushPending}
                    id="/settings/members"
                    Icon={UsersIcon}
                    className={className}
                  />
                ),
                keywords: ["person", "people", "group", ...goToKeywords],
              },
              {
                title: "Notifications",
                titleSuffix: ` | ${settingsTitle}`,
                onSelect: () => {
                  navigateToSettings({ context, pathname: "/notifications" });
                },
                Icon: ({ className }) => (
                  <PendingOrIcon
                    isPending={isAsyncPushPending}
                    id="/settings/notifications"
                    Icon={BellIcon}
                    className={className}
                  />
                ),
                keywords: ["notify", "alert", ...goToKeywords],
              },
              {
                title: "Webhooks",
                titleSuffix: ` | ${settingsTitle}`,
                onSelect: () => {
                  navigateToSettings({ context, pathname: "/webhooks" });
                },
                Icon: ({ className }) => (
                  <PendingOrIcon
                    isPending={isAsyncPushPending}
                    id="/settings/webhooks"
                    Icon={WebhookIcon}
                    className={className}
                  />
                ),
                keywords: ["hook", "integration", "alert", "connection", ...goToKeywords],
              },
              {
                title: "Danger Zone",
                titleSuffix: ` | ${settingsTitle}`,
                onSelect: () => {
                  navigateToSettings({ context, pathname: "/danger-zone" });
                },
                Icon: ({ className }) => (
                  <PendingOrIcon
                    isPending={isAsyncPushPending}
                    id="/settings/danger-zone"
                    Icon={TriangleAlertIcon}
                    className={className}
                  />
                ),
                keywords: ["delete", "danger", ...goToKeywords],
              },
            ],
          },
        },
      ],
    }),
    [
      onSelectPlaceholder,
      utils,
      context,
      settingsTitle,
      PendingOrIcon,
      navigateToSettings,
      goToKeywords,
      createProject,
      isAsyncPushPending,
      isCreateProjectPending,
    ],
  );

  const setCurrentPageId = useCallback(
    (id: string) => {
      setPanelPageId(id);
    },
    [setPanelPageId],
  );

  const currentPage = panelPageId
    ? findCommandPanelPage({
        id: panelPageId,
        page: rootPage,
      }) || rootPage
    : rootPage;

  const allPageIds = useMemo(() => {
    const ids = new Set<string>();
    const addIds = (page: TCommandPanelPage) => {
      ids.add(page.id);
      if (!page.items) return;
      page.items.forEach((item) => {
        if (item.subpage) {
          addIds(item.subpage);
        }
      });
    };
    addIds(rootPage);
    return [...ids];
  }, [rootPage]);

  const goToParentPage = useCallback(
    (e?: KeyboardEvent) => {
      if (currentPage.id === commandPanelContextAwareRootPage) {
        return;
      }
      if (currentPage.parentPageId === null) return;
      const parentPage = findCommandPanelPage({
        id: currentPage.parentPageId,
        page: rootPage,
      });
      if (parentPage) {
        e?.preventDefault();
        setCurrentPageId(parentPage.id);
      }
    },
    [currentPage, rootPage, setCurrentPageId],
  );

  return {
    rootPage,
    currentPage,
    setCurrentPageId,
    allPageIds,
    goToParentPage,
  };
}

function getSettingsPageHref({
  pathname,
  context,
}: {
  pathname: string;
  context: TContextAwareCommandPanelContext;
}) {
  return context.contextType === "project"
    ? `/${context.teamId}/project/${context.projectId}/environment/${context.environmentId}/settings${pathname}`
    : `/${context.teamId}/settings${pathname}`;
}
