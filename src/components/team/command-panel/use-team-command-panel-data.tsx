import { useCommandPanelState } from "@/components/command-panel/command-panel-state-provider";
import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import { findCommandPanelPage } from "@/components/command-panel/helpers";
import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";
import ServiceLogoIcon from "@/components/icons/service-logo-icon";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { commandPanelTeamRootPage } from "@/components/team/command-panel/constants";
import { defaultAnimationMs } from "@/lib/constants";
import { api } from "@/server/trpc/setup/client";
import { BlocksIcon, DatabaseIcon, FolderPlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useTeamCommandPanelData({ teamId }: { teamId: string }) {
  const { setIsPendingId } = useCommandPanelState();

  const [, setPanelId] = useQueryState(commandPanelKey);
  const [panelPageId, setPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelTeamRootPage),
  );
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const { asyncPush } = useAsyncPush();

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
    }, defaultAnimationMs);
  }, [setPanelId, setPanelPageId]);

  const utils = api.useUtils();

  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId: teamId });

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
      await asyncPush(`/${teamId}/project/${projectId}?environment=${environmentId}`);
    },
  });

  const rootPage: TCommandPanelPage = useMemo(
    () => ({
      id: commandPanelTeamRootPage,
      title: "New Project",
      parentPageId: null,
      inputPlaceholder: "Deploy something...",
      items: [
        {
          id: "new-project",
          title: "New Project",
          keywords: ["New Project", "Create project...", "Creating project..."],
          onSelect: ({ isPendingId }) => {
            if (isPendingId === "new-project") return;
            setIsPendingId("new-project");
            createProject({ teamId: teamId });
          },
          Icon: FolderPlusIcon,
        },
        {
          title: "GitHub Repo",
          keywords: ["deploy from github", "deploy from gitlab", "deploy from bitbucket"],
          Icon: ({ className }: { className?: string }) => (
            <ServiceLogoIcon variant="github" className={className} />
          ),
          subpage: {
            id: "github_repos_team",
            title: "GitHub Repos",
            parentPageId: commandPanelTeamRootPage,
            inputPlaceholder: "Deploy from GitHub...",
            getItems: async () => {
              const res = await utils.git.listRepositories.fetch({ teamId });
              const items: TCommandPanelItem[] = res.repositories.map((r) => ({
                title: `${r.full_name}`,
                keywords: [],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }: { className?: string }) => (
                  <ServiceLogoIcon color="brand" variant="github" className={className} />
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
            parentPageId: commandPanelTeamRootPage,
            inputPlaceholder: "Deploy a database...",
            items: [
              {
                title: "PostgreSQL",
                keywords: ["database", "sql", "mysql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="postgresql" className={className} />
                ),
              },
              {
                title: "Redis",
                keywords: ["database", "cache", "key value"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="redis" className={className} />
                ),
              },
              {
                title: "MongoDB",
                keywords: ["database", "object"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="mongodb" className={className} />
                ),
              },
              {
                title: "MySQL",
                keywords: ["database", "sql", "postgresql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="mysql" className={className} />
                ),
              },
              {
                title: "ClickHouse",
                keywords: ["database", "analytics", "sql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="clickhouse" className={className} />
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
            parentPageId: commandPanelTeamRootPage,
            inputPlaceholder: "Deploy a template...",
            items: [
              {
                title: "Strapi",
                keywords: ["cms", "content"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="strapi" className={className} />
                ),
              },
              {
                title: "Umami",
                keywords: ["analytics", "privacy", "tracking"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="umami" className={className} />
                ),
              },
              {
                title: "Meilisearch",
                keywords: ["full text search", "elasticsearch", "ram"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="meilisearch" className={className} />
                ),
              },
              {
                title: "MinIO",
                keywords: ["s3", "file storage"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="minio" className={className} />
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
                  <ServiceLogoIcon color="brand" variant="pocketbase" className={className} />
                ),
              },
              {
                title: "N8N",
                keywords: ["workflow automation", "ai", "devops", "itops"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="n8n" className={className} />
                ),
              },
              {
                title: "Ghost",
                keywords: ["blogging"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceLogoIcon color="brand" variant="ghost" className={className} />
                ),
              },
            ],
          },
        },
        {
          title: "Docker Image",
          keywords: ["deploy"],
          onSelect: () => onSelectPlaceholder(),
          Icon: ({ className }) => <ServiceLogoIcon variant="docker" className={className} />,
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelectPlaceholder, utils, teamId, createProject],
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
      if (currentPage.id === commandPanelTeamRootPage) {
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
