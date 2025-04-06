import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { cn } from "@/components/ui/utils";
import { defaultAnimationMs } from "@/lib/constants";
import { formatKMBT } from "@/lib/helpers";
import { api } from "@/server/trpc/setup/client";
import { DownloadIcon } from "lucide-react";
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
