import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { defaultAnimationMs } from "@/lib/constants";
import { api } from "@/server/trpc/setup/client";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useDockerImageItem() {
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const utils = api.useUtils();

  const onSelectPlaceholder = useCallback(() => {
    toast.success("Successful", {
      description: "This is fake.",
      duration: 3000,
      closeButton: false,
    });
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      closePanel();
    }, defaultAnimationMs);
  }, [closePanel]);

  const item: TCommandPanelItem = useMemo(() => {
    const item: TCommandPanelItem = {
      title: "Docker Image",
      keywords: ["deploy"],
      Icon: ({ className }: { className?: string }) => (
        <BrandIcon brand="docker" className={className} />
      ),
      subpage: {
        id: "docker-images",
        title: "Docker Images",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Search Docker images...",
        usesAsyncSearch: true,
        getItems: async ({ search }) => {
          const res = await utils.docker.searchRepositories.fetch({ search });
          return res.repositories.map((item) => ({
            title: item.repo_name,
            keywords: [item.repo_name],
            Icon: ({ className }) => (
              <BrandIcon brand="docker" color="brand" className={className} />
            ),
            onSelect: () => onSelectPlaceholder(),
          }));
        },
      },
    };
    return item;
  }, [onSelectPlaceholder, utils.docker.searchRepositories]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
