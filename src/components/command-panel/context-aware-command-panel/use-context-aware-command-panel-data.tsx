import { useCommandPanelState } from "@/components/command-panel/command-panel-state-provider";
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
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";
import {
  BellIcon,
  BlocksIcon,
  CornerDownRightIcon,
  DatabaseIcon,
  FolderPlusIcon,
  KeyRoundIcon,
  SettingsIcon,
  TriangleAlertIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useContextAwareCommandPanelData(context: TContextAwareCommandPanelContext) {
  const { setIsPendingId } = useCommandPanelState();

  const [, setPanelId] = useQueryState(commandPanelKey);
  const [panelPageId, setPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelContextAwareRootPage),
  );
  const { asyncPush } = useAsyncPush();
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const utils = api.useUtils();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId: context.teamId });
  const { environmentId } = useIdsFromPathname();

  const { mutate: createProject } = api.projects.create.useMutation({
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
      await invalidateProjects();
      await asyncPush(`/${context.teamId}/project/${projectId}?environment=${environmentId}`);
    },
    onSettled: () => {
      setIsPendingId(null);
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
                id: "new-project",
                title: "New Project",
                keywords: ["New Project", "Create project...", "Creating project..."],
                onSelect: (props) => {
                  if (props?.isPendingId === "new-project") return;
                  setIsPendingId("new-project");
                  createProject({ teamId: context.teamId });
                },
                Icon: FolderPlusIcon,
              },
            ] as TCommandPanelItem[])
          : []),
        {
          title: "GitHub Repo",
          keywords: ["deploy from github", "deploy from gitlab", "deploy from bitbucket"],
          Icon: ({ className }) => <ServiceIcon variant="github" className={className} />,
          subpage: {
            id: "github_repos_context_aware",
            title: "GitHub Repos",
            parentPageId: commandPanelContextAwareRootPage,
            inputPlaceholder: "Deploy from GitHub...",
            getItems: async () => {
              const res = await utils.git.listRepositories.fetch({ teamId: context.teamId });
              const items: TCommandPanelItem[] = res.repositories.map((r) => ({
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
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelectPlaceholder, utils, context, settingsTitle, navigateToSettings, goToKeywords],
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
