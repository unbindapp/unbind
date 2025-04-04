import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { defaultAnimationMs } from "@/lib/constants";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useDockerImageItem() {
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });
  const timeout = useRef<NodeJS.Timeout | null>(null);

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
    return {
      title: "Docker Image",
      keywords: ["deploy"],
      onSelect: () => onSelectPlaceholder(),
      Icon: ({ className }: { className?: string }) => (
        <BrandIcon brand="docker" className={className} />
      ),
    };
  }, [onSelectPlaceholder]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
