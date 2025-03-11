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
import { api } from "@/server/trpc/setup/client";
import { BlocksIcon, DatabaseIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useContextAwareCommandPanelData({
  teamId,
  projectId,
  contextType,
}: TContextAwareCommandPanelContext) {
  console.log("Command Panel Context: ", teamId, projectId, contextType);

  const [, setPanelId] = useQueryState(commandPanelKey);
  const [panelPageId, setPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelContextAwareRootPage),
  );
  const timeout = useRef<NodeJS.Timeout | null>(null);

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

  const utils = api.useUtils();

  const rootPage: TCommandPanelPage = useMemo(
    () => ({
      id: commandPanelContextAwareRootPage,
      title: "Commands",
      parentPageId: null,
      inputPlaceholder: "Search commands...",
      items: [
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
              const res = await utils.main.getGitHubRepos.fetch({ teamId });
              const items: TCommandPanelItem[] = res.repos.map((r) => ({
                title: `${r.owner}/${r.name}`,
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
      ],
    }),
    [onSelectPlaceholder, utils, teamId],
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
