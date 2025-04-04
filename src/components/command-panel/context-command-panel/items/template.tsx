import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { defaultAnimationMs } from "@/lib/constants";
import { BlocksIcon } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useTemplateItem() {
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
      title: "Template",
      keywords: ["blueprint", "stack", "group"],
      Icon: BlocksIcon,
      subpage: {
        id: "templates",
        title: "Templates",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy a template...",
        items: [
          {
            title: "Strapi",
            keywords: ["cms", "content"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="strapi" color="brand" className={className} />
            ),
          },
          {
            title: "Umami",
            keywords: ["analytics", "privacy", "tracking"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="umami" color="brand" className={className} />
            ),
          },
          {
            title: "Meilisearch",
            keywords: ["full text search", "elasticsearch", "ram"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="meilisearch" color="brand" className={className} />
            ),
          },
          {
            title: "MinIO",
            keywords: ["s3", "file storage"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="minio" color="brand" className={className} />
            ),
          },
          {
            title: "PocketBase",
            keywords: ["paas", "backend", "authentication", "realtime database", "file storage"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="pocketbase" color="brand" className={className} />
            ),
          },
          {
            title: "N8N",
            keywords: ["workflow automation", "ai", "devops", "itops"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="n8n" color="brand" className={className} />
            ),
          },
          {
            title: "Ghost",
            keywords: ["blogging"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="ghost" color="brand" className={className} />
            ),
          },
        ],
      },
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
