import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { TAvailableDatabase } from "@/server/go/data.gen";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { DatabaseIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  context: TContextCommandPanelContext;
};

export function databaseTypeToName(type: string) {
  if (type === "postgres") return "PostgreSQL";
  if (type === "mysql") return "MySQL";
  if (type === "redis") return "Redis";
  if (type === "mongodb") return "MongoDB";
  if (type === "clickhouse") return "ClickHouse";
  return type;
}

export function useDatabaseItemHook({ context }: TProps) {
  const hook = useMemo(() => {
    if (context.contextType !== "project" && context.contextType !== "new-service") {
      return () => ({
        item: null,
      });
    }
    return useDatabaseItem;
  }, [context]);

  return hook;
}

function useDatabaseItem({ context }: TProps) {
  const mainPageId = "databases";
  const subpageId = "databases_subpage";

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const { closePanel: closeCommandPanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });
  const { environmentId: environmentIdFromPathname } = useIdsFromPathname();

  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const {
    teamId,
    projectId,
    query: { data: projectData },
  } = useProject();

  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });
  const { invalidate: invalidateProject } = useProjectUtils({ teamId, projectId });

  const { openPanel: openServicePanel } = useServicePanel();

  const environments = projectData?.project.environments;
  const defaultEnvironmentId = projectData?.project.default_environment_id || environments?.[0]?.id;

  const { refetch: refetchServices } = useServicesUtils({
    teamId: context.teamId,
    projectId,
    environmentId: environmentIdFromPathname || defaultEnvironmentId || "",
  });

  const { mutateAsync: createServiceViaApi } = api.services.create.useMutation();
  const { mutateAsync: createService } = useMutation({
    mutationKey: ["create-service", "database"],
    mutationFn: async ({ databaseType }: { databaseType: TAvailableDatabase }) => {
      const environmentId = environmentIdFromPathname || defaultEnvironmentId;
      if (!environmentId) {
        throw new Error("Environment ID is missing");
      }

      const result = await createServiceViaApi({
        type: "database",
        builder: "database",
        database_type: databaseType,
        name: databaseTypeToName(databaseType),
        teamId: context.teamId,
        projectId,
        environmentId,
        isPublic: false,
        autoDeploy: false,
      });

      temporarilyAddNewEntity(result.service.id);

      return result;
    },
    onMutate: async (data) => {
      setIsPendingId(`${subpageId}_${data.databaseType}`);
    },
    onSuccess: async (data) => {
      closeCommandPanel();
      invalidateProject();
      invalidateProjects();

      const res = await ResultAsync.fromPromise(
        refetchServices(),
        () => new Error("Failed to refetch services"),
      );

      if (res.isErr()) {
        toast.error("Failed to refetch services", {
          description: res.error.message,
        });
        setIsPendingId(null);
        return;
      }

      openServicePanel(data.service.id);

      setIsPendingId(null);
    },
    onError: (error) => {
      toast.error("Failed to create service", {
        description: error.message,
      });
      setIsPendingId(null);
    },
  });

  const item: TCommandPanelItem = useMemo(() => {
    return {
      id: mainPageId,
      title: "Database",
      keywords: ["persistent", "persistence"],
      Icon: DatabaseIcon,
      subpage: {
        id: subpageId,
        title: "Databases",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy a database...",
        items: [
          {
            id: `${subpageId}_postgres`,
            title: "PostgreSQL",
            keywords: ["database", "sql", "mysql"],
            onSelect: async ({ isPendingId }) => {
              if (isPendingId !== null) return;
              await createService({ databaseType: "postgres" });
            },
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="postgresql" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_redis`,
            title: "Redis",
            keywords: ["valkey", "cache", "key value", "database"],
            onSelect: async ({ isPendingId }) => {
              if (isPendingId !== null) return;
              await createService({ databaseType: "redis" });
            },
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="redis" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_mysql`,
            title: "MySQL",
            keywords: ["database", "sql", "postgresql", "MariaDB"],
            onSelect: async ({ isPendingId }) => {
              if (isPendingId !== null) return;
              await createService({ databaseType: "mysql" });
            },
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="mysql" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_mongodb`,
            title: "MongoDB",
            keywords: ["database", "nosql", "mongodb", "object database"],
            onSelect: async ({ isPendingId }) => {
              if (isPendingId !== null) return;
              await createService({ databaseType: "mongodb" });
            },
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="mongodb" color="brand" className={className} />
            ),
          },
          {
            id: `${subpageId}_clickhouse`,
            title: "ClickHouse",
            keywords: ["analytics database", "columnar database", "column-oriented"],
            onSelect: async ({ isPendingId }) => {
              if (isPendingId !== null) return;
              await createService({ databaseType: "clickhouse" });
            },
            Icon: ({ className }: { className?: string }) => (
              <BrandIcon brand="clickhouse" color="brand" className={className} />
            ),
          },
        ],
      },
    };
  }, [createService]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
