import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import onSelectPlaceholder from "@/components/command-panel/context-command-panel/items/constants";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { DatabaseIcon } from "lucide-react";
import { useMemo } from "react";

export default function useDatabaseItem({}: { context: TContextCommandPanelContext }) {
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const item: TCommandPanelItem = useMemo(() => {
    return {
      id: `database`,
      title: "Database",
      keywords: ["persistent", "persistence"],
      Icon: DatabaseIcon,
      subpage: {
        id: `databases`,
        title: "Databases",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy a database...",
        items: [
          {
            id: `databases_postgresql`,
            title: "PostgreSQL",
            keywords: ["database", "sql", "mysql"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="postgresql" color="brand" className={className} />
            ),
          },
          {
            id: `databases_redis`,
            title: "Redis",
            keywords: ["database", "cache", "key value"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="redis" color="brand" className={className} />
            ),
          },
          {
            id: `databases_mongodb`,
            title: "MongoDB",
            keywords: ["database", "object"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="mongodb" color="brand" className={className} />
            ),
          },
          {
            id: `databases_mysql`,
            title: "MySQL",
            keywords: ["database", "sql", "postgresql"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="mysql" color="brand" className={className} />
            ),
          },
          {
            id: `databases_mariadb`,
            title: "ClickHouse",
            keywords: ["database", "analytics", "sql"],
            onSelect: () => onSelectPlaceholder(closePanel),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="clickhouse" color="brand" className={className} />
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
