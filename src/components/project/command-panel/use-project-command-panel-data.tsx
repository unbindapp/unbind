import { useProject } from "@/app/(project)/[team_id]/project/[project_id]/_components/project-provider";
import { useCommandPanelState } from "@/components/command-panel/command-panel-state-provider";
import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import { findCommandPanelPage } from "@/components/command-panel/helpers";
import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";
import ServiceIcon from "@/components/icons/service";
import { commandPanelProjectRootPage } from "@/components/project/command-panel/constants";
import { servicePanelServiceIdKey } from "@/components/service/constants";
import { useServicesUtils } from "@/components/project/services-provider";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { BlocksIcon, DatabaseIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useProjectCommandPanelData() {
  const { setIsPendingId } = useCommandPanelState();
  const {
    teamId,
    projectId,
    query: { data: projectData },
  } = useProject();
  const { refetch: refetchServices } = useServicesUtils({
    teamId,
    projectId,
    environmentId: projectData?.project.environments[0].id || "",
  });

  const [, setOpenServicePanelId] = useQueryState(servicePanelServiceIdKey);
  const [, setPanelId] = useQueryState(commandPanelKey);
  const [panelPageId, setPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelProjectRootPage),
  );
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const { mutateAsync: createServiceInDb } = api.services.create.useMutation();
  const { mutateAsync: createService } = useMutation({
    mutationKey: ["create_service"],
    mutationFn: async ({
      repository,
    }: {
      repository: AppRouterOutputs["git"]["listRepositories"]["repositories"][number];
    }) => {
      const environments = projectData?.project.environments;
      if (!environments || environments.length < 1) {
        toast.error("No environments found.");
        throw new Error("No environments found.");
      }
      const environmentId = environments[0].id;
      const owner = repository.full_name.split("/")[0];
      const repoName = repository.full_name.split("/")[1];
      const installationId = repository.installation_id;
      const repoWithDetails = await ResultAsync.fromPromise(
        utils.git.getRepository.fetch({
          installationId,
          owner,
          repoName,
        }),
        () => new Error("Failed to fetch repository."),
      );
      if (repoWithDetails.isErr()) {
        toast.error("Failed to fetch", {
          description: repoWithDetails.error.message,
        });
        throw repoWithDetails.error;
      }
      const branches = repoWithDetails.value.repository.branches;
      if (!branches || branches.length < 1) {
        toast.error("No branches", {
          description: "No branches found in the repository.",
        });
        throw new Error("No branches found in the repository.");
      }
      const firstBranch = branches[0];
      const result = await createServiceInDb({
        type: "github",
        builder: "railpack",
        gitBranch: firstBranch.name,
        repositoryOwner: owner,
        repositoryName: repoName,
        displayName: repoName,
        description: "A new service.",
        teamId,
        projectId,
        environmentId,
        gitHubInstallationId: installationId,
        public: true,
      });
      await refetchServices();
      return result;
    },
    onSuccess: (data) => {
      setOpenServicePanelId(data.service.id);
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

  const closePanel = useCallback(() => {
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
      id: commandPanelProjectRootPage,
      title: "New Service",
      parentPageId: null,
      inputPlaceholder: "Deploy something...",
      items: [
        {
          title: "GitHub Repo",
          keywords: ["deploy from github", "deploy from gitlab", "deploy from bitbucket"],
          Icon: ({ className }) => <ServiceIcon variant="github" className={className} />,
          subpage: {
            id: "github_repos_project",
            title: "GitHub Repos",
            parentPageId: commandPanelProjectRootPage,
            inputPlaceholder: "Deploy from GitHub...",
            getItems: async () => {
              const res = await utils.git.listRepositories.fetch({ teamId });
              const items: TCommandPanelItem[] = res.repositories.map((r) => {
                const id = `git_repo_${r.full_name}`;
                return {
                  id,
                  title: `${r.full_name}`,
                  keywords: [],
                  onSelect: async ({ isPendingId }) => {
                    if (isPendingId !== null) return;
                    setIsPendingId(id);
                    await createService({ repository: r });
                    closePanel();
                  },
                  Icon: ({ className }) => (
                    <ServiceIcon color="brand" variant="github" className={className} />
                  ),
                };
              });
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
            parentPageId: commandPanelProjectRootPage,
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
            parentPageId: commandPanelProjectRootPage,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelectPlaceholder, utils, teamId, closePanel],
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
      if (currentPage.id === commandPanelProjectRootPage) {
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
