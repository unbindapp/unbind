import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { useProject } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useServicesUtils } from "@/components/project/services-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  context: TContextCommandPanelContext;
};

export function useRepoItemHook({ context }: TProps) {
  const hook = useMemo(() => {
    if (context.contextType !== "project" && context.contextType !== "new-service") {
      return () => ({
        item: null,
      });
    }
    return useRepoItem;
  }, [context]);

  return hook;
}

function useRepoItem({ context }: TProps) {
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const utils = api.useUtils();
  const {
    teamId,
    projectId,
    query: { data: projectData },
  } = useProject();

  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });
  const { invalidate: invalidateProject } = useProjectsUtils({ teamId });

  const { openPanel } = useServicePanel();

  const { refetch: refetchServices } = useServicesUtils({
    teamId: context.teamId,
    projectId,
    environmentId: projectData?.project.environments[0].id || "",
  });

  const { mutateAsync: createServiceViaApi } = api.services.create.useMutation();
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
      const result = await createServiceViaApi({
        type: "github",
        builder: "railpack",
        gitBranch: firstBranch.name,
        repositoryOwner: owner,
        repositoryName: repoName,
        displayName: repoName,
        teamId: context.teamId,
        projectId,
        environmentId,
        gitHubInstallationId: installationId,
        public: true,
      });
      await refetchServices();
      return result;
    },
    onSuccess: (data) => {
      openPanel(data.service.id);
      invalidateProject();
      invalidateProjects();
    },
    onSettled: () => {
      setIsPendingId(null);
    },
  });

  const item: TCommandPanelItem = useMemo(() => {
    return {
      id: "repo",
      title: "GitHub Repo",
      keywords: ["deploy from github", "deploy from gitlab", "deploy from bitbucket"],
      Icon: ({ className }: { className?: string }) => (
        <BrandIcon brand="github" className={className} />
      ),
      subpage: {
        id: "github_repos_project",
        title: "GitHub Repos",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy from GitHub...",
        getItems: async () => {
          const res = await utils.git.listRepositories.fetch({ teamId: context.teamId });
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
              Icon: ({ className }: { className?: string }) => (
                <BrandIcon brand="github" color="brand" className={className} />
              ),
            };
          });
          return items;
        },
      },
    };
  }, [utils.git.listRepositories, context, closePanel, createService, setIsPendingId]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
