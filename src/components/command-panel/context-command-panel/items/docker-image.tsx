import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useServicesUtils } from "@/components/project/services-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { cn } from "@/components/ui/utils";
import { formatKMBT } from "@/lib/helpers";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { DownloadIcon, PackageIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

type TProps = {
  context: TContextCommandPanelContext;
};

export function useDockerImageItemHook({ context }: TProps) {
  const hook = useMemo(() => {
    if (context.contextType !== "project" && context.contextType !== "new-service") {
      return () => ({
        item: null,
      });
    }
    return useDockerImageItem;
  }, [context]);

  return hook;
}

const SupportedDockerRegistriesEnum = z.enum(["ghcr.io", "registry.gitlab.com", "quay.io"]);

export function isNonDockerHubImage(image: string) {
  return SupportedDockerRegistriesEnum.options.some((registry) => image.startsWith(`${registry}/`));
}

function cleanSearch(search: string | undefined) {
  if (!search) return "";
  if (search.startsWith("https://")) {
    return search.slice(8);
  }
  if (search.startsWith("http://")) {
    return search.slice(7);
  }
  return search;
}

function useDockerImageItem({ context }: TProps) {
  const { closePanel: closeCommandPanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });
  const { environmentId: environmentIdFromPathname } = useIdsFromPathname();

  const utils = api.useUtils();
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
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
    mutationKey: ["create-service", "docker-image"],
    mutationFn: async ({ image }: { image: string }) => {
      const imageParts = image.split("/");
      const imageName = imageParts[imageParts.length - 1];
      const imageTag = imageName.split(":");
      const imageNameWithoutTag = imageTag[0];

      const environmentId = environmentIdFromPathname || defaultEnvironmentId;
      if (!environmentId) {
        throw new Error("Environment ID is missing");
      }

      const result = await createServiceViaApi({
        type: "docker-image",
        builder: "docker",
        name: imageNameWithoutTag,
        teamId: context.teamId,
        projectId,
        environmentId,
        isPublic: true,
        image,
      });
      return result;
    },
    onSuccess: async (data) => {
      closeCommandPanel();
      invalidateProject();
      invalidateProjects();

      const res = await ResultAsync.fromPromise(
        refetchServices(),
        () => new Error("Failed to refetch services"),
      );
      if (res.isErr()) {
        toast.error("Failed to refetch services", {
          description: res.error.message,
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

  const item: TCommandPanelItem = useMemo(() => {
    const item: TCommandPanelItem = {
      id: `docker-image`,
      title: "Docker Image",
      keywords: ["deploy"],
      Icon: ({ className }: { className?: string }) => (
        <BrandIcon brand="docker" className={className} />
      ),
      subpage: {
        id: `docker-images`,
        title: "Docker Images",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Search Docker images...",
        usesSearchAsync: true,
        ExplanationCard: ({ className }) => (
          <div
            className={cn(
              "text-muted-foreground bg-background-hover mb-1 w-full rounded-md border px-3 pt-1.75 pb-3 text-sm leading-relaxed",
              className,
            )}
          >
            <p className="w-full">You can also enter images from supported registries:</p>
            <p className="w-full">
              {SupportedDockerRegistriesEnum.options.map((registry, i) => (
                <span key={i}>
                  {i !== 0 ? <span>, </span> : null}
                  <span className="text-foreground bg-background rounded-sm border px-1.25">
                    {registry}
                  </span>
                </span>
              ))}
            </p>
          </div>
        ),
        getItemsAsync: async ({ search }) => {
          const cleanedSearch = cleanSearch(search);
          if (cleanedSearch && isNonDockerHubImage(cleanedSearch)) {
            return [
              {
                id: `docker-images_${cleanedSearch}`,
                title: cleanedSearch,
                keywords: [],
                Icon: PackageIcon,
                onSelect: async ({ isPendingId }) => {
                  if (isPendingId !== null) return;
                  setIsPendingId(`docker-images_${cleanedSearch}`);
                  await createService({ image: cleanedSearch });
                },
              },
            ];
          }
          const res = await utils.docker.searchRepositories.fetch({ search });
          return res.repositories.map((item) => {
            const id = `docker-images_${item.repo_name}`;
            return {
              id,
              title: item.repo_name,
              keywords: [item.repo_name],
              Icon: ({ className }) => (
                <BrandIcon brand="docker" color="brand" className={className} />
              ),
              ChipComponent: ({ className }) => (
                <div
                  className={cn(
                    "text-muted-foreground flex items-center justify-end gap-1.5 pl-3 text-right font-mono font-normal",
                    className,
                  )}
                >
                  <DownloadIcon className="-my-1 size-4" />
                  <p className="min-w-0 shrink text-sm">{formatKMBT(item.pull_count)}</p>
                </div>
              ),
              onSelect: async ({ isPendingId }) => {
                if (isPendingId !== null) return;
                setIsPendingId(id);
                await createService({ image: item.repo_name });
              },
            };
          });
        },
      },
    };
    return item;
  }, [utils.docker.searchRepositories, createService, setIsPendingId]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
