import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { defaultAnimationMs } from "@/lib/constants";
import { DatabaseIcon } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export default function useDatabaseItem() {
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
      title: "Database",
      keywords: ["persistent", "persistence"],
      Icon: DatabaseIcon,
      subpage: {
        id: "databases",
        title: "Databases",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy a database...",
        items: [
          {
            title: "PostgreSQL",
            keywords: ["database", "sql", "mysql"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="postgresql" color="brand" className={className} />
            ),
          },
          {
            title: "Redis",
            keywords: ["database", "cache", "key value"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="redis" color="brand" className={className} />
            ),
          },
          {
            title: "MongoDB",
            keywords: ["database", "object"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="mongodb" color="brand" className={className} />
            ),
          },
          {
            title: "MySQL",
            keywords: ["database", "sql", "postgresql"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="mysql" color="brand" className={className} />
            ),
          },
          {
            title: "ClickHouse",
            keywords: ["database", "analytics", "sql"],
            onSelect: () => onSelectPlaceholder(),
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="clickhouse" color="brand" className={className} />
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
