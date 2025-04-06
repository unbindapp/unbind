import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import onSelectPlaceholder from "@/components/command-panel/context-command-panel/items/constants";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { BlocksIcon } from "lucide-react";
import { useMemo } from "react";

export default function useTemplateItem({ context }: { context: TContextCommandPanelContext }) {
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const item: TCommandPanelItem = useMemo(() => {
    return {
      title: "Template",
      keywords: ["blueprint", "stack", "group"],
      Icon: BlocksIcon,
      subpage: {
        id: `templates_${context.contextType}`,
        title: "Templates",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy a template...",
        items: [
          {
            title: "Strapi",
            keywords: ["cms", "content"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="strapi" color="brand" className={className} />
            ),
          },
          {
            title: "Umami",
            keywords: ["analytics", "privacy", "tracking"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="umami" color="brand" className={className} />
            ),
          },
          {
            title: "Meilisearch",
            keywords: ["full text search", "elasticsearch", "ram"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="meilisearch" color="brand" className={className} />
            ),
          },
          {
            title: "MinIO",
            keywords: ["s3", "file storage"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="minio" color="brand" className={className} />
            ),
          },
          {
            title: "PocketBase",
            keywords: ["paas", "backend", "authentication", "realtime database", "file storage"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="pocketbase" color="brand" className={className} />
            ),
          },
          {
            title: "N8N",
            keywords: ["workflow automation", "ai", "devops", "itops"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="n8n" color="brand" className={className} />
            ),
          },
          {
            title: "Ghost",
            keywords: ["blogging"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="ghost" color="brand" className={className} />
            ),
          },
        ],
      },
    };
  }, [closePanel, context]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
