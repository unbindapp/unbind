import { TCommandPanelItem } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { defaultAnimationMs } from "@/lib/constants";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useDockerImageItem() {
  const { setPanelId, setPanelPageId } = useCommandPanel();
  const timeout = useRef<NodeJS.Timeout | null>(null);

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
