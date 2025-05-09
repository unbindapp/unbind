import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TriggerTypeEnum } from "@/components/command-panel/context-command-panel/context-command-panel";
import { getContextCommandPaneItemsQueryKey } from "@/components/command-panel/context-command-panel/context-command-panel-items-provider";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useServicesUtils } from "@/components/project/services-provider";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { createClient } from "@/server/go/client.gen";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BuildingIcon, CogIcon, HourglassIcon, UnplugIcon, UserIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { toast } from "sonner";

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

function useGitItem({ context }: TProps) {
  const mainPageId = "git";
  const subpageId = "git_subpage";

  const { closePanel: closeCommandPanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const { environmentId: environmentIdFromPathname } = useIdsFromPathname();

  const utils = api.useUtils();
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
    teamId: context.teamId,
    projectId,
    environmentId: environmentIdFromPathname || defaultEnvironmentId || "",
  });

  const { mutateAsync: createServiceViaApi } = api.services.create.useMutation();
  const { mutateAsync: createService } = useMutation({
    mutationKey: ["create-service", "git"],
    mutationFn: async ({
      repository,
    }: {
      repository: AppRouterOutputs["git"]["listRepositories"]["repositories"][number];
    }) => {
      const owner = repository.full_name.split("/")[0];
      const repoName = repository.full_name.split("/")[1];
      const installationId = repository.installation_id;

      const environmentId = environmentIdFromPathname || defaultEnvironmentId;
      if (!environmentId) {
        throw new Error("Environment ID is missing");
      }

      const result = await createServiceViaApi({
        type: "github",
        builder: "railpack",
        repositoryOwner: owner,
        repositoryName: repoName,
        name: repoName,
        teamId: context.teamId,
        projectId,
        environmentId,
        gitHubInstallationId: installationId,
        isPublic: true,
      });
      return result;
    },
    onSuccess: async (data) => {
      closeCommandPanel();
      invalidateProject();
      invalidateProjects();

      const refetchRes = await ResultAsync.fromPromise(
        refetchServices(),
        () => new Error("Failed to refetch services"),
      );
      if (refetchRes.isErr()) {
        toast.error("Failed to refetch services", {
          description: refetchRes.error.message,
        });
        setIsPendingId(null);
        return;
      }

      openServicePanel(data.service.id);

      setIsPendingId(null);
    },
    onError: (error) => {
      toast.error("Failed to create service", {
        description: error.message,
      });
      setIsPendingId(null);
    },
  });

  const { apiUrl } = useAppConfig();
  const gitHubRedirectPathname = `/${teamId}/connect-git/connected/github`;
  const sessionData = useSession();
  const queryClient = useQueryClient();
  const clearInputValue = useCommandPanelStore((s) => s.clearInputValue);

  const { mutateAsync: createGitHubAppMutate } = useMutation({
    mutationFn: async ({
      accessToken,
      redirectUrl,
      organizationName,
      onSuccess,
    }: {
      accessToken: string;
      redirectUrl: string;
      organizationName?: string;
      onSuccess: () => void;
    }) =>
      createGitHubApp({
        redirectUrl,
        accessToken,
        apiUrl,
        organizationName,
        onSuccess,
      }),
    mutationKey: ["create-github-app", { teamId }],
  });

  const item: TCommandPanelItem = useMemo(() => {
    const itemsPinned: TCommandPanelItem[] = [
      {
        id: "git_configure_github",
        title: "Configure GitHub App",
        keywords: ["connect", "configure", "github", "gitlab", "bitbucket"],
        Icon: CogIcon,
        subpage: {
          id: "git_configure_github_options",
          title: "GitHub App",
          inputPlaceholder: "Select GitHub account type...",
          parentPageId: subpageId,
          items: [
            {
              id: "git_configure_github_options_personal",
              keywords: ["personal", "github"],
              title: "Personal",
              Icon: UserIcon,
              onSelect: async ({ isPendingId, setCurrentPageId }) => {
                if (isPendingId !== null) return;
                if (!sessionData.data?.access_token) {
                  toast.error("Your current session is invalid. Please sign in again.");
                  return;
                }
                setIsPendingId("git_configure_github_options_personal");
                const res = await ResultAsync.fromPromise(
                  createGitHubAppMutate({
                    accessToken: sessionData.data.access_token,
                    redirectUrl: window.location.origin + gitHubRedirectPathname,
                    onSuccess: () => {
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
                      utils.git.listRepositories.reset();
                      queryKeys.forEach((queryKey) => {
                        queryClient.resetQueries({ queryKey });
                      });
                      setCurrentPageId(subpageId);
                      toast.success("GitHub app connected", {
                        description: "GitHub app has been connected successfully.",
                        duration: 5000,
                        closeButton: false,
                      });
                    },
                  }),
                  () => new Error("Failed to create GitHub app"),
                );
                if (res.isErr()) {
                  toast.error("Failed to create GitHub app", {
                    description: res.error.message,
                  });
                  setIsPendingId(null);
                  return;
                }
                setIsPendingId(null);
              },
            },
            {
              id: "git_configure_github_options_organization",
              keywords: ["organization", "github"],
              title: "Organization",
              Icon: BuildingIcon,
              subpage: {
                id: "git_configure_github_options_organization_enter_name",
                title: "GitHub Organization",
                inputPlaceholder: "Organization name",
                parentPageId: "git_configure_github_options",
                disableCommandFilter: true,
                setSearchDebounceMs: 50,
                InputIcon: BuildingIcon,
                commandEmptyText: "Enter the organization name",
                getItems: ({ search }) =>
                  !search
                    ? []
                    : [
                        {
                          id: "git_configure_github_options_organization_connect",
                          title: search ? `Connect "${search}"` : "Enter organization name",
                          Icon: !search ? HourglassIcon : UnplugIcon,
                          keywords: ["connect", "organization", "github"],
                          disabled: !search,
                          onSelect: async ({ isPendingId, setCurrentPageId }) => {
                            if (isPendingId !== null) return;
                            if (!sessionData.data?.access_token) {
                              toast.error("Your current session is invalid. Please sign in again.");
                              return;
                            }
                            setIsPendingId("git_configure_github_options_organization_connect");
                            const res = await ResultAsync.fromPromise(
                              createGitHubAppMutate({
                                accessToken: sessionData.data.access_token,
                                redirectUrl: window.location.origin + gitHubRedirectPathname,
                                organizationName: search,
                                onSuccess: () => {
                                  const environmentId =
                                    environmentIdFromPathname || defaultEnvironmentId;
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
                                  utils.git.listRepositories.reset();
                                  queryKeys.forEach((queryKey) => {
                                    queryClient.resetQueries({ queryKey });
                                  });
                                  clearInputValue(
                                    "git_configure_github_options_organization_enter_name",
                                  );
                                  setCurrentPageId(subpageId);
                                  toast.success("GitHub app connected", {
                                    description: "GitHub app has been connected successfully.",
                                    duration: 5000,
                                    closeButton: false,
                                  });
                                },
                              }),
                              () => new Error("Failed to create GitHub app"),
                            );
                            if (res.isErr()) {
                              toast.error("Failed to create GitHub app", {
                                description: res.error.message,
                              });
                              setIsPendingId(null);
                              return;
                            }
                            setIsPendingId(null);
                          },
                        },
                      ],
              },
            },
          ],
        },
      },
    ];

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
        itemsPinned,
        getItemsAsync: async () => {
          const res = await utils.git.listRepositories.fetch();
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
    utils.git.listRepositories,
    createService,
    setIsPendingId,
    sessionData,
    createGitHubAppMutate,
    gitHubRedirectPathname,
    defaultEnvironmentId,
    environmentIdFromPathname,
    queryClient,
    teamId,
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

async function createGitHubApp({
  redirectUrl,
  accessToken,
  apiUrl,
  onSuccess,
  organizationName,
}: {
  redirectUrl: string;
  accessToken: string;
  apiUrl: string;
  onSuccess: () => void;
  organizationName?: string;
}) {
  const width = 800;
  const height = 600;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  const svg = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>`;
  const popup = window.open(
    "",
    "GitHubAuth",
    `width=${width},height=${height},top=${top},left=${left}`,
  );

  if (!popup) {
    toast.error("Popup was blocked. Please allow popups for this site.");
    return;
  }

  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.success === true) {
      clearInterval(interval);
      onSuccess();
      window.removeEventListener("message", messageHandler);
      popup.close();
    }
  };

  window.addEventListener("message", messageHandler);

  popup.document.write(`
    <html>
      <title>Connect GitHub</title>
      <head>
        <style>
          body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .loader-container {
            display: flex;
            justify-content: center;
            align-items: center;
            padding-bottom: calc(1rem + 4vh);
          }
          .loader {
            width: 2rem;
            height: 2rem;
            animation: spin 1s linear infinite;
          }
          .icon {
            width: 100%;
            height: 100%;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader-container">
          <div class="loader">
            ${svg}
          </div>
        </div>
      </body>
    </html>
  `);

  const abortController = new AbortController();

  const interval = setInterval(() => {
    if (popup.closed) {
      clearInterval(interval);
      abortController.abort();
    }
  }, 250);

  const goClient = createClient({ accessToken, apiUrl });

  const res = await goClient.github.app.create(
    { redirect_url: redirectUrl, organization: organizationName },
    { signal: abortController.signal },
  );
  popup.document.write(res.data);
}
