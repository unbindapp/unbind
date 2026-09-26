import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TriggerTypeEnum } from "@/components/command-panel/context-command-panel/context-command-panel";
import { getContextCommandPaneItemsQueryKey } from "@/components/command-panel/context-command-panel/context-command-panel-items-provider";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { connectGitHub, githubConnectedPath } from "@/components/git/connect-github";
import BrandIcon from "@/components/icons/brand";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import { useUniqueServiceName } from "@/components/service/use-unique-service-name";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { usePendingEntityStore } from "@/components/stores/pending/pending-entity-store-provider";
import { toast } from "@/components/ui/toast";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { gitRepositoriesQuery, queryKeyGitApps, type TGitRepository } from "@/lib/queries/git";
import {
  createService as createServiceFn,
  type TBuilderEnum,
  type TGitServiceBuilder,
} from "@/lib/queries/services";
import { teamQuery } from "@/lib/queries/teams";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BuildingIcon,
  CogIcon,
  HourglassIcon,
  LockIcon,
  UnplugIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

type TProps = {
  context: TContextCommandPanelContext;
};

export function useGitItemHook({ context }: TProps) {
  const hook = useMemo(() => {
    if (context.contextType !== "project" && context.contextType !== "new-service") {
      return () => ({
        item: null,
      });
    }
    return useGitItem;
  }, [context]);

  return hook;
}

export const defaultGitServiceBuilder: TGitServiceBuilder = "railpack";
export const builderEnumToName = (builder: TBuilderEnum) => {
  if (builder === "database") return "Database";
  if (builder === "docker") return "Docker";
  if (builder === "railpack") return "Railpack";
  return "Unknown Builder";
};

function useGitItem({ context }: TProps) {
  const mainPageId = "git";
  const subpageId = "git_subpage";

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();
  const addPendingService = usePendingEntityStore((s) => s.addPendingService);
  const removePendingService = usePendingEntityStore((s) => s.removePendingService);

  const { closePanel: closeCommandPanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const { environmentId: environmentIdFromPathname } = useIdsFromPathname();

  const {
    teamId,
    projectId,
    query: { data: projectData },
  } = useProject();

  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });
  const { invalidate: invalidateProject } = useProjectUtils({ teamId, projectId });

  const { openPanel: openServicePanel } = useServicePanel();

  const environments = projectData?.project.environments;
  const defaultEnvironmentId = projectData?.project.default_environment_id || environments?.[0]?.id;

  const { refetch: refetchServices } = useServicesUtils({
    teamId,
    projectId,
    environmentId: environmentIdFromPathname || defaultEnvironmentId || "",
  });

  const getUniqueServiceName = useUniqueServiceName({
    teamId,
    projectId,
    environmentId: environmentIdFromPathname || defaultEnvironmentId || "",
  });

  const { mutateAsync: createServiceWithName } = useMutation({
    mutationKey: ["create-service", "git"],
    mutationFn: async ({ repository, name }: { repository: TGitRepository; name: string }) => {
      const owner = repository.full_name.split("/")[0];
      const repoName = repository.full_name.split("/")[1];
      const installationId = repository.installation_id;

      const environmentId = environmentIdFromPathname || defaultEnvironmentId;
      if (!environmentId) {
        throw new Error("Environment ID is missing");
      }

      const result = await createServiceFn({
        type: "github",
        builder: defaultGitServiceBuilder,
        repository_owner: owner,
        repository_name: repoName,
        name,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        github_installation_id: installationId,
        is_public: false,
        auto_deploy: true,
        replicas: 1,
      });

      temporarilyAddNewEntity(result.service.id);

      return result;
    },
    onMutate: ({ name }) => {
      closeCommandPanel();
      const pendingId = uuidv4();
      addPendingService({
        id: pendingId,
        teamId,
        projectId,
        environmentId: environmentIdFromPathname || defaultEnvironmentId || "",
        name,
        icon: "github",
        createdAt: new Date().toISOString(),
      });
      return { pendingId };
    },
    onSuccess: async (data) => {
      invalidateProject();
      invalidateProjects();

      const refetchRes = await ResultAsync.fromPromise(
        refetchServices(),
        () => new Error("Failed to refetch services"),
      );
      if (refetchRes.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to refetch services",
          description: refetchRes.error.message,
        });
        setIsPendingId(null);
        return;
      }

      openServicePanel(data.service.id);

      setIsPendingId(null);
    },
    onError: (error) => {
      toast.add({ type: "error", title: "Failed to create service", description: error.message });
      setIsPendingId(null);
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context) return;
      removePendingService(context.pendingId);
    },
  });
  const createService = useCallback(
    ({ repository }: { repository: TGitRepository }) =>
      createServiceWithName({
        repository,
        name: getUniqueServiceName(repository.full_name.split("/")[1]),
      }),
    [createServiceWithName, getUniqueServiceName],
  );

  const queryClient = useQueryClient();
  const { data: teamData } = useQuery(teamQuery({ teamId }));
  const teamName = teamData?.team.name ?? "this team";
  const clearInputValue = useCommandPanelStore((s) => s.clearInputValue);

  const { mutateAsync: connectGitHubMutate } = useMutation({
    mutationFn: connectGitHub,
    mutationKey: ["connect-github", { teamId }],
  });

  const item: TCommandPanelItem = useMemo(() => {
    const connected = ({ setCurrentPageId }: { setCurrentPageId: (id: string) => void }) => {
      const environmentId = environmentIdFromPathname || defaultEnvironmentId;
      if (!environmentId) {
        return;
      }
      const queryKeys = TriggerTypeEnum.options.map((triggerType) =>
        getContextCommandPaneItemsQueryKey({
          teamId,
          projectId,
          context,
          hasItems: false,
          searchKey: null,
          pageId: subpageId,
          triggerType,
          environmentId,
        }),
      );
      queryClient.resetQueries({ queryKey: gitRepositoriesQuery().queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeyGitApps.all() });
      queryKeys.forEach((queryKey) => {
        queryClient.resetQueries({ queryKey });
      });
      setCurrentPageId(subpageId);
      toast.add({
        type: "success",
        title: "GitHub connected",
        description: "You can see its repositories now.",
        timeout: 5000,
      });
    };

    const connect = async ({
      pendingId,
      share,
      organizationName,
      setCurrentPageId,
      onSuccess,
    }: {
      pendingId: string;
      share: boolean;
      organizationName?: string;
      setCurrentPageId: (id: string) => void;
      onSuccess?: () => void;
    }) => {
      setIsPendingId(pendingId);
      const res = await ResultAsync.fromPromise(
        connectGitHubMutate({
          redirectUrl: window.location.origin + githubConnectedPath(),
          organizationName,
          teamId: share ? teamId : undefined,
          onSuccess: () => {
            onSuccess?.();
            connected({ setCurrentPageId });
          },
        }),
        () => new Error("Failed to create GitHub app"),
      );
      if (res.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to create GitHub app",
          description: res.error.message,
        });
      }
      setIsPendingId(null);
    };

    // The account type page exists once per sharing choice, so every page id stays unique
    const accountTypePage = (share: boolean) => {
      const scope = share ? "team" : "me";
      const pageId = `git_configure_github_${scope}_account_type`;
      const organizationPageId = `git_configure_github_${scope}_organization`;
      return {
        id: pageId,
        title: "GitHub App",
        inputPlaceholder: "Select GitHub account type...",
        parentPageId: "git_configure_github_sharing",
        items: [
          {
            id: `${pageId}_personal`,
            keywords: ["personal", "github"],
            title: "Personal",
            Icon: UserIcon,
            onSelect: async ({ isPendingId, setCurrentPageId }) => {
              if (isPendingId !== null) return;
              await connect({ pendingId: `${pageId}_personal`, share, setCurrentPageId });
            },
          },
          {
            id: `${pageId}_organization`,
            keywords: ["organization", "github"],
            title: "Organization",
            Icon: BuildingIcon,
            subpage: {
              id: organizationPageId,
              title: "GitHub Organization",
              inputPlaceholder: "Organization name",
              parentPageId: pageId,
              disableCommandFilter: true,
              setSearchDebounceMs: 50,
              InputIcon: BuildingIcon,
              commandEmptyText: "Enter the organization name above",
              getItems: ({ search }) =>
                !search
                  ? []
                  : [
                      {
                        id: `${organizationPageId}_connect`,
                        title: search ? `Connect "${search}"` : "Enter organization name",
                        Icon: !search ? HourglassIcon : UnplugIcon,
                        keywords: ["connect", "organization", "github"],
                        disabled: !search,
                        onSelect: async ({ isPendingId, setCurrentPageId }) => {
                          if (isPendingId !== null) return;
                          await connect({
                            pendingId: `${organizationPageId}_connect`,
                            share,
                            organizationName: search,
                            setCurrentPageId,
                            onSuccess: () => clearInputValue(organizationPageId),
                          });
                        },
                      },
                    ],
            },
          },
        ],
      } satisfies TCommandPanelItem["subpage"];
    };

    const configureGitHubItem: TCommandPanelItem = {
      id: "git_configure_github",
      title: "Configure GitHub App",
      keywords: ["connect", "configure", "github", "gitlab", "bitbucket"],
      Icon: CogIcon,
      subpage: {
        id: "git_configure_github_sharing",
        title: "Who should see the repositories?",
        inputPlaceholder: "Who should see the repositories?",
        parentPageId: subpageId,
        items: [
          {
            id: "git_configure_github_sharing_me",
            keywords: ["only me", "private", "github"],
            title: "Only me",
            description: "Only you can see these repositories.",
            Icon: LockIcon,
            subpage: accountTypePage(false),
          },
          {
            id: "git_configure_github_sharing_team",
            keywords: ["team", "share", "github"],
            title: "This team",
            description: `Members of ${teamName} can see them too.`,
            Icon: UsersIcon,
            subpage: accountTypePage(true),
          },
        ],
      },
    };

    return {
      id: mainPageId,
      title: "GitHub Repo",
      keywords: ["deploy from github", "deploy from gitlab", "deploy from bitbucket"],
      Icon: ({ className }: { className?: string }) => (
        <BrandIcon brand="github" className={className} />
      ),
      subpage: {
        id: subpageId,
        title: "GitHub Repos",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy from GitHub...",
        itemsPinned: [configureGitHubItem],
        getItemsAsync: async () => {
          const res = await queryClient.fetchQuery(gitRepositoriesQuery());
          const items: TCommandPanelItem[] = res.repositories.map((r) => {
            const id = `${subpageId}_${r.full_name}`;
            return {
              id,
              title: `${r.full_name}`,
              keywords: [],
              onSelect: async ({ isPendingId }) => {
                if (isPendingId !== null) return;
                setIsPendingId(id);
                await createService({ repository: r });
              },
              Icon: ({ className }: { className?: string }) => (
                <BrandIcon brand="github" color="brand" className={className} />
              ),
            };
          });
          return items;
        },
      },
    };
  }, [
    queryClient,
    createService,
    setIsPendingId,
    connectGitHubMutate,
    defaultEnvironmentId,
    environmentIdFromPathname,
    teamId,
    teamName,
    projectId,
    context,
    clearInputValue,
  ]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
