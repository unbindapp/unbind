import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import TitleChip from "@/components/command-panel/title-chip";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useProject } from "@/components/project/project-provider";
import ServiceIcon from "@/components/service/service-icon";
import {
  getDuplicateServiceNames,
  ServicePickerDescription,
} from "@/components/service/service-picker";
import { useServicesUtils } from "@/components/service/services-provider";
import { useSystem } from "@/components/system/system-provider";
import { toast } from "@/components/ui/toast";
import { getDefaultVolumeName } from "@/components/volume/default-volume-name";
import { getMountPathError } from "@/components/volume/mount-path";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { useVolumesUtils } from "@/components/volume/volumes-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { servicesListQuery, TServiceShallow } from "@/lib/queries/services";
import { createVolume as createVolumeFn } from "@/lib/queries/storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BoxIcon, FolderClosedIcon, HardDriveIcon, TriangleAlertIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";

type TProps = {
  context: TContextCommandPanelContext;
};

export function useVolumeItemHook({ context }: TProps) {
  const hook = useMemo(() => {
    if (context.contextType !== "project" && context.contextType !== "new-service") {
      return () => ({
        item: null,
      });
    }
    return useVolumeItem;
  }, [context]);

  return hook;
}

const mainPageId = "volume";
const servicesPageId = "volume_services";
const defaultMountPath = "/data";

function mountPathPageId(serviceId: string) {
  return `volume_mount_path_${serviceId}`;
}

// Databases manage their own storage and a service holds one volume at most
function canAttachVolume(service: TServiceShallow) {
  return service.type !== "database" && service.config.volumes.length === 0;
}

function getEmptyText({
  isPending,
  hasServices,
  hasEligibleServices,
}: {
  isPending: boolean;
  hasServices: boolean;
  hasEligibleServices: boolean;
}) {
  if (isPending) return "Loading services...";
  if (!hasServices) return "No services to attach to";
  if (!hasEligibleServices) return "All services already have a volume";
  return undefined;
}

function getDefaultCapacityGb(minimumStorageGb: number | undefined) {
  return Math.max(1, minimumStorageGb ?? 1);
}

function useVolumeItem({ context }: TProps) {
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
  const { data: systemData } = useSystem();
  const { openPanel: openVolumePanel } = useVolumePanel();

  const environments = projectData?.project.environments;
  const defaultEnvironmentId = projectData?.project.default_environment_id || environments?.[0]?.id;
  const environmentId = environmentIdFromPathname || defaultEnvironmentId || "";

  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });
  const { invalidate: invalidateVolumes } = useVolumesUtils({ teamId, projectId, environmentId });

  const { data: servicesData, isPending: isPendingServices } = useQuery({
    ...servicesListQuery({ teamId, projectId, environmentId }),
    enabled: environmentId !== "",
  });

  const eligibleServices = useMemo(
    () => servicesData?.services.filter(canAttachVolume) ?? [],
    [servicesData],
  );
  const hasServices = (servicesData?.services.length ?? 0) > 0;

  const minimumStorageGb = systemData?.data.storage.minimum_storage_gb;

  const { mutateAsync: createVolume } = useMutation({
    mutationKey: ["create-volume"],
    mutationFn: async ({ service, mountPath }: { service: TServiceShallow; mountPath: string }) => {
      if (!environmentId) {
        throw new Error("Environment ID is missing");
      }
      return createVolumeFn({
        teamId: context.teamId,
        projectId,
        environmentId,
        name: getDefaultVolumeName(service.name),
        capacityGb: getDefaultCapacityGb(minimumStorageGb),
        serviceId: service.id,
        mountPath,
      });
    },
    onSuccess: async (data) => {
      const res = await ResultAsync.fromPromise(
        Promise.all([refetchServices(), invalidateVolumes()]),
        () => new Error("Failed to refetch services"),
      );
      if (res.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to refetch services",
          description: res.error.message,
        });
        setIsPendingId(null);
        return;
      }

      closeCommandPanel();
      openVolumePanel(data.volume.id);
      setIsPendingId(null);
    },
    onError: (error) => {
      toast.add({ type: "error", title: "Failed to create volume", description: error.message });
      setIsPendingId(null);
    },
  });

  const serviceItems: TCommandPanelItem[] = useMemo(() => {
    const duplicateNames = getDuplicateServiceNames(eligibleServices);
    return eligibleServices.map((service) => {
      const pageId = mountPathPageId(service.id);
      const mountItemId = `${pageId}_mount`;
      return {
        id: `${servicesPageId}_${service.id}`,
        title: service.name,
        keywords: [],
        description: duplicateNames.has(service.name)
          ? () => <ServicePickerDescription service={service} />
          : undefined,
        Icon: ({ className }) => <ServiceIcon service={service} className={className} />,
        subpage: {
          id: pageId,
          title: `Mount on ${service.name}`,
          parentPageId: servicesPageId,
          inputPlaceholder: defaultMountPath,
          InputIcon: FolderClosedIcon,
          disableCommandFilter: true,
          setSearchDebounceMs: 50,
          commandEmptyText: "Enter a mount path above",
          getItems: ({ search }) => {
            const mountPath = search || defaultMountPath;
            const error = getMountPathError(mountPath);
            if (error) {
              return [
                {
                  id: mountItemId,
                  title: error,
                  keywords: [],
                  Icon: TriangleAlertIcon,
                  disabled: true,
                },
              ];
            }
            return [
              {
                id: mountItemId,
                title: `Mount at ${mountPath}`,
                Title: () => (
                  <>
                    Mount at <TitleChip>{mountPath}</TitleChip>
                  </>
                ),
                description: search ? undefined : "Default path, type to change it",
                keywords: [],
                Icon: HardDriveIcon,
                onSelect: async ({ isPendingId }) => {
                  if (isPendingId !== null) return;
                  setIsPendingId(mountItemId);
                  await createVolume({ service, mountPath });
                },
              },
            ];
          },
        },
      };
    });
  }, [eligibleServices, createVolume, setIsPendingId]);

  const item: TCommandPanelItem = useMemo(
    () => ({
      id: mainPageId,
      title: "Volume",
      keywords: ["storage", "persistent", "disk", "pvc", "mount"],
      Icon: BoxIcon,
      subpage: {
        id: servicesPageId,
        title: "Attach to Service",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Select a service...",
        commandEmptyText: getEmptyText({
          isPending: isPendingServices,
          hasServices,
          hasEligibleServices: eligibleServices.length > 0,
        }),
        items: serviceItems,
      },
    }),
    [serviceItems, isPendingServices, hasServices, eligibleServices.length],
  );

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
