import ErrorLine from "@/components/error-line";
import { useServices } from "@/components/project/services-provider";
import { Input } from "@/components/ui/input";
import { useVolume } from "@/components/volume/volume-provider";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { FolderClosedIcon } from "lucide-react";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function ConnectionSection({ volume }: TProps) {
  const {
    query: { data: volumeData, isPending: isPendingVolume, error: errorVolume },
  } = useVolume();

  const {
    query: { data: servicesData, isPending: isPendingServices, error: errorServices },
  } = useServices();

  const attachedService =
    servicesData && volumeData
      ? servicesData.services.find(
          (service) => service.id === volumeData.volume.mounted_on_service_id,
        )
      : undefined;

  const isPending = isPendingVolume || isPendingServices;
  const error = errorVolume || errorServices;
  const hasData = volumeData && servicesData;

  return (
    <div
      data-pending={isPending ? true : undefined}
      className="group/section flex w-full flex-col gap-2.5 md:max-w-xl"
    >
      <p className="text-muted-foreground w-full px-1.5 leading-tight">
        {isPending ? (
          <span className="bg-muted-foreground animate-skeleton rounded-md text-transparent">
            Loading connection details...
          </span>
        ) : attachedService ? (
          <span>
            This volume is attached to{" "}
            <span className="text-foreground font-semibold">{attachedService.name}</span> on:
          </span>
        ) : error ? (
          <span>Something went wrong.</span>
        ) : (
          <span>This volume is not attached to a service.</span>
        )}
      </p>
      <div className="relative w-full">
        <FolderClosedIcon className="text-muted-foreground group-data-pending/section:animate-skeleton group-data-pending/section:bg-muted-foreground absolute top-1/2 left-3.25 z-[1] size-5 -translate-y-1/2 group-data-pending/section:rounded-md" />
        <Input
          disabled
          fadeOnDisabled={false}
          value={
            isPending
              ? "Loading"
              : !hasData && error
                ? "Error"
                : volume.mount_path
                  ? volume.mount_path
                  : "Not attached"
          }
          className="relative pl-10.25 group-data-pending/section:opacity-0 disabled:cursor-text"
        />
        {isPending && (
          <div className="bg-input absolute top-0 left-0 flex h-full w-full items-center justify-start rounded-lg border pr-3 pl-10.25">
            <p className="bg-foreground animate-skeleton max-w-full min-w-0 truncate rounded-md leading-tight">
              Loading...
            </p>
          </div>
        )}
      </div>
      {!volumeData && !isPendingVolume && errorVolume && (
        <ErrorLine message={errorVolume.message} />
      )}
      {!servicesData && !isPendingServices && errorServices && (
        <ErrorLine message={errorServices.message} />
      )}
    </div>
  );
}
