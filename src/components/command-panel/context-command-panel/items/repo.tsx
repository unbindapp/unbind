import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { defaultAnimationMs } from "@/lib/constants";
import { api } from "@/server/trpc/setup/client";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

type TProps = {
  context: TContextCommandPanelContext;
};

export default function useRepoItem({ context }: TProps) {
  const { setPanelId, setPanelPageId } = useCommandPanel();
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const utils = api.useUtils();

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

  const item: TCommandPanelItem = useMemo(() => {
    return {
      title: "GitHub Repo",
      keywords: ["deploy from github", "deploy from gitlab", "deploy from bitbucket"],
      Icon: ({ className }: { className?: string }) => (
        <BrandIcon brand="github" className={className} />
      ),
      subpage: {
        id: "github_repos_context_aware",
        title: "GitHub Repos",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy from GitHub...",
        getItems: async () => {
          const res = await utils.git.listRepositories.fetch({ teamId: context.teamId });
          const items: TCommandPanelItem[] = res.repositories.map((r) => ({
            title: `${r.full_name}`,
            keywords: [],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="github" color="brand" className={className} />
            ),
          }));
          return items;
        },
      },
    };
  }, [onSelectPlaceholder, utils.git.listRepositories, context.teamId]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
