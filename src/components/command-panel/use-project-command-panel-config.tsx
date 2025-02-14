import {
  panelIdKey,
  panelPageIdKey,
  rootPanelPageIdForProject,
} from "@/components/command-panel/constants";
import { findCommandPanelPage } from "@/components/command-panel/helpers";
import { TCommandPanelPage } from "@/components/command-panel/types";
import ServiceIcon from "@/components/icons/service";
import { api } from "@/server/trpc/setup/client";
import { BlocksIcon, DatabaseIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export default function useProjectCommandPanelConfig() {
  const [, setPanelId] = useQueryState(panelIdKey);
  const [panelPageId, setPanelPageId] = useQueryState(panelPageIdKey);

  const onSelectPlaceholder = useCallback(() => {
    toast.success("Successful (Fake)", {
      description: "Imagine this working...",
      duration: 3000,
      closeButton: false,
    });
    setPanelId(null);
    setPanelPageId(null);
  }, [setPanelId, setPanelPageId]);

  const defaultPage: TCommandPanelPage = useMemo(
    () => ({
      id: rootPanelPageIdForProject,
      parentPageId: null,
      itemsQuery: () => null,
      items: [
        {
          title: "GitHub Repo",
          keywords: ["deploy", "gitlab", "bitbucket"],
          Icon: ({ className }) => (
            <ServiceIcon variant="github" className={className} />
          ),
          subpage: {
            id: "github_repos",
            parentPageId: rootPanelPageIdForProject,
            isAsync: true,
            itemsQuery: () => {
              const { data, isError, isPending } =
                api.main.getGitHubRepos.useQuery({});
              return {
                isPending,
                isError,
                data: data
                  ? data.repos.map((repo) => ({
                      title: repo.owner + "/" + repo.name,
                      keywords: [],
                      onSelect: () => onSelectPlaceholder(),
                      Icon: ({ className }: { className?: string }) => (
                        <ServiceIcon variant="github" className={className} />
                      ),
                    }))
                  : undefined,
              };
            },
          },
        },
        {
          title: "Database",
          keywords: ["persistent", "persistence"],
          Icon: DatabaseIcon,
          subpage: {
            id: "databases",
            parentPageId: rootPanelPageIdForProject,
            itemsQuery: () => null,
            items: [
              {
                title: "PostgreSQL",
                keywords: ["database", "sql", "mysql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="postgresql"
                    className={className}
                  />
                ),
              },
              {
                title: "Redis",
                keywords: ["database", "cache", "key value"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="redis"
                    className={className}
                  />
                ),
              },
              {
                title: "MongoDB",
                keywords: ["database", "object"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="mongodb"
                    className={className}
                  />
                ),
              },
              {
                title: "MySQL",
                keywords: ["database", "sql", "postgresql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="mysql"
                    className={className}
                  />
                ),
              },
              {
                title: "ClickHouse",
                keywords: ["database", "analytics", "sql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="clickhouse"
                    className={className}
                  />
                ),
              },
            ],
          },
        },
        {
          title: "Docker Image",
          keywords: ["deploy"],
          onSelect: () => onSelectPlaceholder(),
          Icon: ({ className }) => (
            <ServiceIcon variant="docker" className={className} />
          ),
        },
        {
          title: "Template",
          keywords: ["blueprint", "stack", "group"],
          Icon: BlocksIcon,
          subpage: {
            id: "templates",
            parentPageId: rootPanelPageIdForProject,
            itemsQuery: () => null,
            items: [
              {
                title: "Strapi",
                keywords: ["cms", "content"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="strapi"
                    className={className}
                  />
                ),
              },
              {
                title: "Umami",
                keywords: ["analytics", "privacy", "tracking"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="umami"
                    className={className}
                  />
                ),
              },
              {
                title: "Meilisearch",
                keywords: ["full text search", "elasticsearch", "ram"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="meilisearch"
                    className={className}
                  />
                ),
              },
              {
                title: "MinIO",
                keywords: ["s3", "file storage"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="minio"
                    className={className}
                  />
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
                  <ServiceIcon
                    color="brand"
                    variant="pocketbase"
                    className={className}
                  />
                ),
              },
              {
                title: "N8N",
                keywords: ["workflow automation", "ai", "devops", "itops"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="n8n"
                    className={className}
                  />
                ),
              },
              {
                title: "Ghost",
                keywords: ["blogging"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="ghost"
                    className={className}
                  />
                ),
              },
            ],
          },
        },
      ],
    }),
    [onSelectPlaceholder]
  );

  const [currentPage, setCurrentPage] = useState(
    panelPageId
      ? findCommandPanelPage({
          id: panelPageId,
          page: defaultPage,
        }) || defaultPage
      : defaultPage
  );

  const allPageIds = useMemo(() => {
    const ids = new Set<string>();
    const addIds = (page: TCommandPanelPage) => {
      ids.add(page.id);
      if (page.isAsync) return;
      if (!page.items) return;
      page.items.forEach((item) => {
        if (item.subpage) {
          addIds(item.subpage);
        }
      });
    };
    addIds(defaultPage);
    return [...ids];
  }, [defaultPage]);

  const goToParentPage = useCallback(
    (e?: KeyboardEvent) => {
      if (currentPage.id === rootPanelPageIdForProject) {
        return;
      }
      if (currentPage.parentPageId === null) return;
      const parentPage = findCommandPanelPage({
        id: currentPage.parentPageId,
        page: defaultPage,
      });
      if (parentPage) {
        e?.preventDefault();
        setCurrentPage(parentPage);
      }
    },
    [currentPage, defaultPage]
  );

  return {
    defaultPage,
    currentPage,
    setCurrentPage,
    setPanelPageId,
    allPageIds,
    goToParentPage,
  };
}
