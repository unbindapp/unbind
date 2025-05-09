import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import onSelectPlaceholder from "@/components/command-panel/context-command-panel/items/constants";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { BlocksIcon } from "lucide-react";
import { useMemo } from "react";

export default function useTemplateItem({}: { context: TContextCommandPanelContext }) {
  const mainPageId = "template";
  const subpageId = "template_subpage";

  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const item: TCommandPanelItem = useMemo(() => {
    return {
      id: mainPageId,
      title: "Template",
      keywords: ["blueprint", "stack", "group"],
      Icon: BlocksIcon,
      subpage: {
        id: subpageId,
        title: "Templates",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy a template...",
        items: [
          {
            id: `${subpageId}_strapi`,
            title: "Strapi",
            keywords: ["cms", "content"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="strapi" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_umami`,
            title: "Umami",
            keywords: ["analytics", "privacy", "tracking"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="umami" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_meilisearch`,
            title: "Meilisearch",
            keywords: ["full text search", "elasticsearch", "ram"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="meilisearch" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_minio`,
            title: "MinIO",
            keywords: ["s3", "file storage"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="minio" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_pocketbase`,
            title: "PocketBase",
            keywords: ["paas", "backend", "authentication", "realtime database", "file storage"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="pocketbase" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_n8n`,
            title: "N8N",
            keywords: ["workflow automation", "ai", "devops", "itops"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="n8n" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_ghost`,
            title: "Ghost",
            keywords: ["blogging"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="ghost" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_wordpress`,
            title: "WordPress",
            keywords: [
              "blogging",
              "php",
              "cms",
              "content",
              "publishing platform",
              "website",
              "ecommerce",
              "WooCommerce",
            ],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="wordpress" color="brand" className={className} />
            ),
          },
        ],
      },
    };
  }, [closePanel]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
